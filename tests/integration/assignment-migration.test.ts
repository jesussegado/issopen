import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";

it("adds optional human assignment without rewriting old ownership, claims, status or history", async () => {
  const folder = await mkdtemp(join(tmpdir(), "issopen-assignment-upgrade-"));
  const container = await new PostgreSqlContainer(
    "postgres:18.6-alpine",
  ).start();
  const connection = createDatabase(container.getConnectionUri());
  try {
    await cp("drizzle", folder, { recursive: true });
    const path = join(folder, "meta/_journal.json");
    const journal = JSON.parse(await readFile(path, "utf8"));
    journal.entries = journal.entries.filter(
      (entry: { idx: number }) => entry.idx < 23,
    );
    await writeFile(path, JSON.stringify(journal));
    await migrateDatabase(container.getConnectionUri(), folder);
    const owner = randomUUID(),
      space = randomUUID(),
      project = randomUUID(),
      ticket = randomUUID(),
      agent = randomUUID(),
      event = randomUUID();
    await connection.client`insert into "user" (id,name,email) values (${owner},'Owner',${`${owner}@example.test`})`;
    await connection.client`insert into workspace (id,owner_id,name) values (${space},${owner},'Space')`;
    await connection.client`insert into workspace_membership (workspace_id,user_id,role) values (${space},${owner},'owner')`;
    await connection.client`insert into project (id,workspace_id,key,name) values (${project},${space},'PRJ','Project')`;
    await connection.client`insert into agent_identity (id,workspace_id,name) values (${agent},${space},'Historic agent')`;
    await connection.client`insert into issue (id,workspace_id,project_id,number,key,title,human_owner_id,status,claimed_by_agent_id,claimed_at) values (${ticket},${space},${project},1,'PRJ-1','Existing',${owner},'in_progress',${agent},now())`;
    await connection.client`insert into activity_event (id,workspace_id,project_id,issue_id,type,actor_type,actor_id,actor_display_name,source,summary,changes) values (${event},${space},${project},${ticket},'issue.claimed','agent',${agent},'Historic agent','mcp','Claimed','{}')`;
    const before = (await connection.client`select * from issue`)[0];
    const question = randomUUID(),
      option = randomUUID();
    const options = JSON.stringify([
      { id: option, label: "Original answer", description: "Historical" },
    ]);
    await connection.client`insert into issue_question (id,workspace_id,issue_id,prompt,recommendation,options,recommended_option_id,answer_option_id,answered_by_user_id,answered_at) values (${question},${space},${ticket},'Old question','Original recommendation',${options}::jsonb,${option},${option},${owner},now())`;
    const oldQuestion = (
      await connection.client`select * from issue_question`
    )[0];
    const comment = randomUUID();
    await connection.client`insert into issue_comment (id,workspace_id,issue_id,body,author_type,author_id,author_display_name,source) values (${comment},${space},${ticket},'Original immutable comment','human',${owner},'Original owner','rest')`;
    const oldComment = (
      await connection.client`select * from issue_comment`
    )[0];
    const history = await connection.client`select * from activity_event`;
    const oldAccessId = randomUUID();
    await connection.client`insert into membership_event (id,workspace_id,subject_user_id,actor_user_id,type,next_role) values (${oldAccessId},${space},${owner},${owner},'membership.created','owner')`;
    const oldAccess = (
      await connection.client`select * from membership_event where id=${oldAccessId}`
    )[0];
    await migrateDatabase(container.getConnectionUri());
    expect(
      (
        await connection.client`select * from membership_event where id=${oldAccessId}`
      )[0],
    ).toEqual({ ...oldAccess, actor_name: null, subject_name: null });
    expect((await connection.client`select * from issue_comment`)[0]).toEqual({
      ...oldComment,
      mentions: [],
      web_request_id: null,
      web_request_hash: null,
    });
    expect(await connection.client`select * from notification`).toHaveLength(0);
    expect(
      await connection.client`select * from authentication_assurance`,
    ).toHaveLength(0);
    expect(
      await connection.client`select * from ownership_transfer`,
    ).toHaveLength(0);
    expect(await connection.client`select * from ownership_event`).toHaveLength(
      0,
    );
    const current = (await connection.client`select * from issue`)[0];
    expect(current).toEqual({
      ...before,
      human_assignee_id: null,
      human_assignee_name: null,
    });
    expect(await connection.client`select * from activity_event`).toEqual(
      history,
    );
    expect((await connection.client`select * from issue_question`)[0]).toEqual({
      ...oldQuestion,
      recipient_user_id: null,
      recipient_name: null,
    });
    await connection.client`update issue_question set recipient_user_id=${owner},recipient_name='Owner' where id=${question}`;
    const directedQuestion =
      await connection.client`select * from issue_question`;
    await connection.client`update issue set human_assignee_id=${owner}, human_assignee_name='Owner' where id=${ticket}`;
    const saved = await connection.client`select * from issue`;
    await migrateDatabase(container.getConnectionUri());
    expect(await connection.client`select * from issue`).toEqual(saved);
    expect(await connection.client`select * from issue_question`).toEqual(
      directedQuestion,
    );
    await expect(
      connection.client`update issue_question set recipient_name=null where id=${question}`,
    ).rejects.toThrow();
    await expect(
      connection.client`update issue set human_assignee_name=null where id=${ticket}`,
    ).rejects.toThrow();
    await expect(
      connection.client`update issue set human_assignee_id=${randomUUID()} where id=${ticket}`,
    ).rejects.toThrow();
  } finally {
    await connection.close();
    await container.stop();
    await rm(folder, { recursive: true, force: true });
  }
}, 120_000);
