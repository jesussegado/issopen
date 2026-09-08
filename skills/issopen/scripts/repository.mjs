// Pure comparison: never executes a remote, follows a URL or guesses host aliases.
export function repositoryIdentity(value) {
  if (typeof value !== "string" || !value || /\s/.test(value)) return null;
  const scp = value.match(/^([^@/:]+@)?([^/:]+):([^/].*)$/);
  const input =
    scp && !value.includes("://")
      ? `ssh://${scp[1] ?? ""}${scp[2]}/${scp[3]}`
      : value;
  try {
    const url = new URL(input);
    if (
      !["ssh:", "https:", "http:"].includes(url.protocol) ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    if (url.protocol !== "ssh:" && url.username) return null;
    const path = url.pathname.replace(/\/$/, "").replace(/\.git$/, "");
    if (!path || path === "/") return null;
    const port =
      url.port ||
      { "ssh:": "22", "https:": "443", "http:": "80" }[url.protocol];
    return `${url.protocol}//${url.hostname.toLowerCase()}:${port}${path}`;
  } catch {
    return null;
  }
}

export function matchingProjects(remote, relativeDirectory, projects) {
  const identity = repositoryIdentity(remote);
  if (
    !identity ||
    relativeDirectory.startsWith("/") ||
    relativeDirectory.split("/").includes("..")
  )
    return [];
  return projects.filter((project) => {
    const subdirectory = (project.repositorySubdirectory ?? "").replace(
      /\/$/,
      "",
    );
    return (
      repositoryIdentity(project.repositoryUrl) === identity &&
      (!subdirectory ||
        relativeDirectory === subdirectory ||
        relativeDirectory.startsWith(`${subdirectory}/`))
    );
  });
}
