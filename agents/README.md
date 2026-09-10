# agents

给 agent 会话看的操作约定。总入口与红线见 [AGENTS.md](../AGENTS.md)，开一个新窗口怎么起手见 [parallel_prompt.md](../parallel_prompt.md)，通道与消息见 `.cursor/rules/idp-mcp-messenger.mdc`，平台写法见 [`fanqie-webnovel-writing/SKILL.md`](../.cursor/skills/fanqie-webnovel-writing/SKILL.md)。

本目录只写这几处**都没有**的东西：仓库层面的权威边界、问题往哪登记、流程的落差、多个通道共写一棵树的做法。

| 文件 | 什么时候读 |
| --- | --- |
| [domain.md](./domain.md) | 写任何东西之前。哪些文件是设定真源、目录归谁、冲突按什么顺序裁、改设定要走什么流程 |
| [workflow.md](./workflow.md) | 认领一段章号之后。一章怎么走、门禁扫描怎么跑、红线在哪一步生效、本机踩过的坑 |
| [issue-tracker.md](./issue-tracker.md) | 发现问题时。裁决记录、冲突清单、审校记录、元信息「待确认」、MCP 任务分别装什么 |
| [triage-labels.md](./triage-labels.md) | 写审校记录时。必改与建议的口径、归属、定位格式、门禁的盲区 |
| [parallel-sessions.md](./parallel-sessions.md) | 多个通道同时在写时。地盘、公共文件、盲覆盖、没有版本控制该怎么办 |

新人按 `domain.md` → `workflow.md` 的顺序读，其余三份用到再翻。

**两条最容易踩、后果最贵的，先记住：**

1. **这棵树没有 git，写坏了没有回退。** 大范围改动前先复制一份，全库写回类命令不得单方面跑。见 [workflow.md 的取证](./workflow.md#取证这东西是谁什么时候改的)。
2. **设定文档全部封存定稿，让步顺序是「正文让给大纲，大纲让给设定」**，和长篇后期的通行做法相反。见 [domain.md 的冲突裁定](./domain.md#冲突按什么顺序裁)。

**本目录六份文件末尾各有一张修订记录表。** 改了内容就加一行——这棵树没有 git，那张表是唯一的历史，理由见 [workflow.md 的取证](./workflow.md#取证这东西是谁什么时候改的)。

## 修订记录

**从上往下按时间顺序读，最下面一条最新。**

> 这张表 2026-08-28 才补建。`agents/` 六份此前都没有修订记录，**初版到补建之间的改动查不回来**，下面不追记。

| # | 日期 | 变更 |
| --- | --- | --- |
| 1 | 2026-08-27 | 初版 |
| 2 | 2026-08-28 | 六份文件末尾统一补建修订记录表，并在本文加一句说明。此前 `workflow.md` 自己写着「你改的文件末尾没有这张表，就补一张」，而 `agents/` 自己一份都没有 |
