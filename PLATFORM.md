# Platform relationship

This is an independent `application` source repository under
`~/Projects/platform/`. Its canonical private remote is
`ssh://git@192.168.2.165:2222/jsegado/issopen.git`.

The desired deployment state lives separately in
`~/Projects/platform/homelab/apps/issopen/`. This source produces artifacts
and images; `homelab` references immutable versions and never relies on this
local checkout to reconcile production.
