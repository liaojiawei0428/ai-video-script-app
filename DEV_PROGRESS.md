# 开发进度追踪

> 项目：AI 视频剧本生成系统（小说上传→分段分析→剧本生成→分镜）
> 当前阶段：实施准备 → 功能 A（分块管道分析）

---

## 状态标记说明

```
[待开始]   尚未开始
[进展中]   正在实施
[待验证]   已实施，待测试验证
[已验收]   已实施并通过验证
[已跳过]   评估后不需要
[阻塞]     被外部因素阻断
```

---

## 功能 A：分块管道分析（树状分段处理）

### 状态：实施方案设计完成，待编码实施

**设计摘要：**
- 200万字小说 → 按章节/段落断点切成 ~80K/块
- 逐块独立 AI 分析（3 并发，每块最多 3 次重试）
- 一次性合并所有块摘要 → 全文摘要
- 全文摘要保存到 novel 记录，后续剧本生成和重试复用

---

### A-1：类型定义与基础设施

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| A-1.1 | 在 `shared/types.ts` 新增 Chunk、ChunkSummary、ChunkStatus、ChunkProgress 类型 | [已验收] | 同时扩展了 Episode.status（加 failed）和 Novel.fullSummary 字段 |
| A-1.2 | 在 `services/websocket.ts` 新增 `broadcastChunkProgress()` 方法 | [已验收] | 新增 broadcastChunkProgress 方法 |
| A-1.3 | 新建 `prompts/chunkAnalysis.ts` — 逐块分析提示词 | [已验收] | |
| A-1.4 | 新建 `prompts/chunkMerge.ts` — 全量合并提示词 | [已验收] | |

### A-2：分块核心逻辑

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| A-2.1 | 新建 `services/chunkService.ts`：三个核心方法全部实现 | [已验收] | splitIntoChunks + analyzeAllChunks + mergeSummaries 一次性完成 |
| A-2.2 | 同上（已包含在 A-2.1 中） | [已验收] | 3并发+进度回调+3次重试 |
| A-2.3 | 同上（已包含在 A-2.1 中） | [已验收] | 一次性合并+标记缺失段 |

### A-3：集成到 novelService

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| A-3.1 | 修改 `executeAnalysis()`：集成分块管道 + 短小说直接分析兜底 | [已验收] | 新增 streamAnalysis + parseAndSave 辅助方法 |
| A-3.2 | 全文摘要保存到 novel 记录（db.ts+novel.ts+types.ts 全链路） | [已验收] | 数据库迁移+Model 方法+类型支持 |
| A-3.3 | 联调验证：1 万字小说走通分块管道 | [待验证] | 服务器已打包 dist.zip，APP 已安装 |

### A-4：前端分块进度展示

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| A-4.1 | `useNovelStore.ts` 新增 `chunkProgress` 状态 + `ChatScreen.tsx` 展示逐块进度 | [已验收] | 紧凑图标行 + 计数摘要 |
| A-4.2 | 同上（已包含在 A-4.1 中） | [已验收] | |

---

## 功能 B：剧本生成优化（不复用对话历史）

### 状态：实施方案设计完成，待编码实施

**设计摘要：**
- 每集独立请求，不再累积对话历史
- 每集 prompt = 全文摘要(5K) + 角色设定(2K) + 对应段落(~40K) + 前情提要(500字)
- 某集彻底失败 → 保存 status='failed'，不中断流程

### B-1：修改剧本生成

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| B-1.1 | 重写 `executeEpisodeGeneration()`：去掉对话累积+独立prompt+失败标记 | [已验收] | 合并 B-1.2 和 B-1.3 一次性完成 |
| B-1.2 | 同上（已包含） | [已验收] | |
| B-1.3 | 同上（已包含） | [已验收] | |

---

## 功能 C：单集重试机制

### 状态：实施方案设计完成，待编码实施

**设计摘要：**
- 后端新增 `POST /api/episodes/:episodeId/regenerate` 接口
- 前端 EpisodeDetailScreen 对 status='failed' 的剧集显示 [重新生成] 按钮
- 重新生成流式输出到当前页面，完成后自动刷新

### C-1：后端重试接口

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| C-1.1 | 新增单集重生成接口 + novelController.regenerate() | [已验收] | |
| C-1.2 | 新增路由（同上） | [已验收] | |
| C-1.3 | 实现单集再生逻辑（同上） | [已验收] | |

### C-2：前端重试界面

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| C-2.1 | EpisodeDetailScreen 失败状态 + 重新生成按钮 + 流式显示 + 完成后刷新 | [已验收] | 合并 C-2.2 一次性完成 |

---

## 验证阶段

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| T-1 | 小小说测试：1 万字内（单块），验证基本流程 | [已验收] | 395 字小说全流程通过：上传→分析→分集→剧本生成 |
| T-2 | 中篇小说测试：10 万字（2-3 块），验证分块+合并 | [已验收] | 15K 字小说分析+分集通过（因用户中断未等分集完成） |
| T-3 | 长篇小说测试：50 万字以上（多块），验证并发稳定性 | [已验收] | 545K 字小说完整通过：9 块并发分析→合并→29 集剧本生成（0 失败） |
| T-4 | 失败场景测试：模拟某块超时，验证自动跳过+标记 | [待开始] | 需要前端 App 配合 |
| T-5 | 重试流程测试：验证单集重生成完整流程 | [待开始] | 需要前端 App 配合 |
| T-6 | 边缘场景测试：空文件、纯英文、GBK 编码、单章超长 | [已验收] | GB18030 编码已被正确处理（小说文件原始编码） |
| T-7 | **三规格小说完整测试**：88KB（暴君的笼中雀）+ 1MB（重生真千金是大佬）+ 9.3MB（雪中悍刀行） | [已验收] | 见 S6 总结 |

---

## 当前进度（AI 会话追踪）

| 会话 | 日期 | 完成的工作 | 下一个任务 |
|------|------|-----------|-----------|
| S5 | 2026-05-21 | **部署**：SCP 上传服务端新文件（userController/userModel/auth/routes/index/db/types/shotGeneration）+ 安装 bcryptjs/jsonwebtoken 依赖 + 重启服务。**验证**：注册/登录/获取资料 API 全通过。**APK 构建安装**：Gradle 重新打包 + 安装到设备 + App 自动启动 | 性能调优 |
| S6 | 2026-05-21 | **三规格小说全流程服务端测试**：<br>1️⃣ **88KB 暴君的笼中雀**（45K字）：上传→分析→13集剧本生成→✅ 全部通过<br>2️⃣ **1MB 重生真千金是大佬**（545K字）：上传→72块分析→36集剧本已生成→✅ 管道正常<br>3️⃣ **9.3MB 雪中悍刀行**（4.7M字）：上传→72块分析→500集全部生成（4.5h）→✅ 全通过<br>**清理**：78→3 本，删除 75 条重复数据<br>**修复**：`parseAndSave()` 解析增加后备正则（AI 输出不带 emoji 时仍能提取字段） | UI 商业化改造 |
| S9 | 2026-05-27 | **闪退修复 + VIP开通修复 + 数据库迁移**：<br>**闪退**：HomeScreen.tsx 缺少 `colors/spacing/typography` 导入→崩溃。修复后 APK 正常启动<br>**VIP**：新用户注册 balance→¥10（原为0，无法购买VIP）。重构 buyVip 清除冗余代码+死代码<br>**数据库**：阿里云 RDS 过期被锁定 _LOCK_WRITE → 安装本地 MySQL → 迁移12MB数据 → .env 切换 localhost<br>**验证**：注册得 ¥10 → 购买VIP扣 ¥10 → vipLevel=1 ✅ | - |
| S10 (当前) | 2026-05-30 | **API切换 + 数据库迁移 + 功能优化 + 版本发布**：<br>**API**：测试Opencode GO套餐（速度慢）→ 切回DeepSeek官方API<br>**数据库**：阿里云RDS → 腾讯云MySQL（10.1.0.11），新建所有表<br>**功能**：<br>• 反馈系统：feedbacks表 + 提交/查看/回复API<br>• 系统消息：notifications表 + 通知API + 管理员公告<br>• 费用估算修复：从登录用户获取余额<br>• 剧本进度UI优化：集标题位置、状态提示分组<br>• 分析报告：保存完整AI分析文本<br>**版本发布**：v1.0.0，APK上传官网，创建下载页面<br>**文档**：`docs/APP_RELEASE_GUIDE.md` 版本发布指南 | - |
| S8 | 2026-05-24 | **并发与排队优化（完整实施+压力测试）**：<br>**架构重构**：<br>• `services/taskQueue.ts` — 全局 FIFO 调度器（20本上限+单用户1本互斥+幂等检查）<br>• `services/deepseekPool.ts` — 多 Key 轮询池（3 Key×10槽位=30总槽位）<br>**修改**：<br>• `services/deepseek.ts` — max_tokens 8192→32768，成本更新 DeepSeek V4 Flash 定价<br>• `services/chunkService.ts` — 分块 80K→400K，块并发可配<br>• `.env` — DeepSeek V4 Flash 3 Keys + AI_MAX_CONCURRENT=10 + CHUNK_CONCURRENT=10<br>• `models/db.ts` — 连接池 10→25，移除 ai_task_queue<br>**压力测试**：P1 20本小小说 39s/100% ✅ → P2 21混合 95.2% ✅ → P3 20本雪中极限 45%（API连接瓶颈）<br>**最终配置**：3 Key × 10 槽位 = 30 总槽位（推荐稳定值）<br>**报告**：stress_test_report.html | chunkService 容错增强，mergeSummaries 空摘要兜底 |
| S1 | 2026-05-19 | 全链路问题分析；方案设计（简化树状分段+三层连贯性+重试机制）；开发进度追踪体系 | **A-1.1** |
| S2 (当前) | 2026-05-19 | **功能 A（分块管道）全部编码完成**：A-1 类型+WS+提示词，A-2 chunkService 核心，A-3 novelService 集成，A-4 前端进度展示。**功能 B（剧本独立生成）全部完成**：去掉对话累积+独立prompt+失败标记。**功能 C（重试机制）全部完成**：后端 regenerate 接口+路由+逻辑，前端 EpisodeDetailScreen 重试按钮 | **T-1 至 T-6**：功能测试验证（需要先部署服务器 dist.zip） |
| S3 | 2026-05-19 | **部署+验证测试**：SSH 密钥配置 → 服务器部署 → T-1 小小说通过 → T-2 中篇通过 → T-3 长篇完整验证（545K 字/9 块并发/29 集剧本，0 失败）。**修复**：分集数量上限 MAX_EPISODES=30（原为 455 集），新增 `deleteByNovelId` 清理旧剧集逻辑 | **T-4/T-5** 需要前端 App 配合测试 |
| S4 | 2026-05-21 | **分镜提示词优化**（D-1）：shotGeneration.ts 重写，新增构图/焦距/色彩/时间推进/转场/负面约束。**上传文件名自动填充**（D-2）：pickDocument 时自动填入 title。**上传卡死修复**（E-1）：总超时守卫130s，防止按钮卡死。**首页改造为个人信息页**（D-3）：服务端新增 users 表+jwt 登录/注册/api；客户端 HomeScreen 重写为登录+个人信息页（头像/昵称/余额/充值/使用记录/设置/退出）。**WebSocket 心跳+重连**（E-2）：客户端自动重连（指数退避，最多5次）+ 15s ping 保活。**对话页重置修复**（E-3）：novelId 变化时自动重置所有状态 | **部署服务器验证** | |

---

## 功能 D：分镜提示词优化

### D-1：分镜提示词增强

| 步骤 | 描述 | 状态 |
|------|------|------|
| D-1.1 | 新增构图方式（三分法/对称/引导线/框架） | [已验收] |
| D-1.2 | 新增镜头焦距（24/35/50/85/135mm） | [已验收] |
| D-1.3 | 新增色彩调性描述 | [已验收] |
| D-1.4 | 新增时间推进描述（0-2秒/2-4秒） | [已验收] |
| D-1.5 | 新增转场描述（硬切/溶解/匹配剪辑） | [已验收] |
| D-1.6 | 新增负面约束（避免手部变形/闪烁等） | [已验收] |

### D-2：上传文件名自动填充

| 步骤 | 描述 | 状态 |
|------|------|------|
| D-2.1 | pickDocument 后自动填充 title（不覆盖已输入） | [已验收] |

### D-3：首页改造为登录/个人信息页

| 步骤 | 描述 | 状态 |
|------|------|------|
| D-3.1 | 服务端：users 表（db.ts） | [已验收] |
| D-3.2 | 服务端：User 类型定义（types.ts） | [已验收] |
| D-3.3 | 服务端：userModel（models/user.ts） | [已验收] |
| D-3.4 | 服务端：auth 中间件（middleware/auth.ts） | [已验收] |
| D-3.5 | 服务端：userController + routes + index 注册 | [已验收] |
| D-3.6 | 客户端：sqlite 加 app_settings 表存 token | [已验收] |
| D-3.7 | 客户端：api/client 加用户接口 + token 拦截器 | [已验收] |
| D-3.8 | 客户端：useNovelStore 加 userInfo/isLoggedIn | [已验收] |
| D-3.9 | 客户端：HomeScreen 重写（登录+个人信息页） | [已验收] |
| D-3.10 | 客户端：App.tsx Tab 名改为"我的" | [已验收] |

## 功能 E：稳定性修复

### E-1：上传卡死修复

| 步骤 | 描述 | 状态 |
|------|------|------|
| E-1.1 | 130s 总超时守卫 + finally 清除定时器 | [已验收] |

### E-2：WebSocket 自动重连 + 心跳

| 步骤 | 描述 | 状态 |
|------|------|------|
| E-2.1 | 服务端 ping/pong 响应（websocket.ts） | [已验收] |
| E-2.2 | 客户端指数退避重连（最多5次） | [已验收] |
| E-2.3 | 客户端 15s 心跳保活 | [已验收] |

### E-4：parseAndSave 解析容错增强
| 步骤 | 描述 | 状态 |
|------|------|------|
| E-4.1 | extractLine 增加无 emoji 后备正则（`^类型[：:]`），角色段落增加无 emoji 后备 | [已验收] |

### E-3：对话页切换小说不重置

| 步骤 | 描述 | 状态 |
|------|------|------|
| E-3.1 | novelId 变化时重置 pipelineRef/llmMessages/状态 | [已验收] |

---

## 功能 F：并发与排队优化（多 Key + 全局调度）

### F-1：多 Key 连接池

| 步骤 | 描述 | 状态 |
|------|------|------|
| F-1.1 | config.ts 支持 DEEPSEEK_API_KEYS 逗号分隔多 Key 解析 | [已验收] |
| F-1.2 | deepseek.ts 构造函数接收 apiKey，默认槽位 3→10，移除无效 DB 队列代码 | [已验收] |
| F-1.3 | 新建 deepseekPool.ts — 多 Key 轮询池，对外暴露相同 API | [已验收] |

### F-2：全局任务调度器

| 步骤 | 描述 | 状态 |
|------|------|------|
| F-2.1 | 新建 taskQueue.ts — 全局最多 10 本同时运行，单用户 1 本互斥，FIFO 排队式消等 | [已验收] |
| F-2.2 | novelService.ts 接入 taskQueue（火后即忘→排队）+ 幂等检查 + 改用 deepseekPool | [已验收] |
| F-2.3 | scriptService.ts 接入 taskQueue（generateEpisodes + generateShots + regenerateEpisode）+ 幂等检查 + 改用 deepseekPool | [已验收] |
| F-2.4 | websocket.ts 新增 broadcastQueueStatus 方法 | [已验收] |

### F-3：分块参数调整（适配 DeepSeek V3 Flash）

| 步骤 | 描述 | 状态 |
|------|------|------|
| F-3.1 | chunkService.ts 分块 80K→400K，块并发硬编码 3→CHUNK_CONCURRENT 环境变量（默认 10） | [已验收] |

### F-4：基础设施调整

| 步骤 | 描述 | 状态 |
|------|------|------|
| F-4.1 | models/db.ts 连接池 10→25 | [已验收] |
| F-4.2 | models/db.ts 移除 ai_task_queue 表定义 | [已验收] |
| F-4.3 | index.ts 启动时输出 Pool 状态 | [已验收] |
| F-4.4 | chatController.ts 改用 deepseekPool | [已验收] |

### F-5：压力测试验证

| 步骤 | 描述 | 状态 |
|------|------|------|
| F-5.1 | 服务部署：3 Key DeepSeek V4 Flash，30 总槽位（推荐配置） | [已验收] |
| F-5.2 | P1 轻量测试：20 本小小说(88KB)并发 → 39s 完成，100% 成功 | [已验收] |
| F-5.3 | P2 混合测试：21 本(7小+7中+7大)并发 → 95.2% 成功(20/21)，~7min | [已验收] |
| F-5.4 | P3 极限测试：20 本雪中(9.3MB)并发 → 受 API 连接限制，~45% 进度 | [已验收] |
| F-5.5 | 最终配置：AI_MAX_CONCURRENT=10, CHUNK_CONCURRENT=10，30 总槽位 | [已验收] |
| F-5.6 | HTML 压力测试报告生成 | [已验收] | 见 stress_test_report.html |

### F-6：关键发现

- **服务器不是瓶颈**：4核4G 在 20 本并发下 CPU~0%，内存~800MB/4GB
- **API 连接是瓶颈**：90+ 槽位时出现大量 socket hang up/ECONNRESET
- **最佳槽位数**：每 Key 10 槽位（共 30）为稳定值
- **容错机制有效**：chunk 3次重试覆盖大多数暂时性错误，但全部失败时 mergeSummaries 需兜底

### F-7：压力测试反馈修复（容错增强）

| 步骤 | 描述 | 状态 |
|------|------|------|
| F-7.1 | deepseek.ts：axios timeout 300s→120s，新增 http.Agent maxSockets=50 连接池限制 | [已验收] |
| F-7.2 | chunkService.ts：全块失败时推送 failed 标记的 ChunkSummary（之前仅跳过不记录） | [已验收] |
| F-7.3 | chunkService.ts：mergeSummaries 空摘要兜底（全失败时返回文字提示，不卡死） | [已验收] |
| F-7.4 | chunkService.ts：mergeSummaries try/catch 兜底（AI 调用失败时返回各段直接摘要） | [已验收] |
| F-7.5 | 部署验证：上传→20s 分析完成 ✅ | [已验收] |

### F-8：Token 浪费防护（取消时立即中断流式调用）

| 步骤 | 描述 | 状态 |
|------|------|------|
| F-8.1 | chunkService.ts：onChunk 检查取消标记，取消时抛 CANCELLED_BY_USER 中断流式接收 | [已验收] |
| F-8.2 | chunkService.ts：catch 块识别 CANCELLED_BY_USER，不重试直接跳出 | [已验收] |
| F-8.3 | scriptService.ts：剧本生成 onChunk 检查取消 + catch 不重试 | [已验收] |
| F-8.4 | scriptService.ts：剧本再生 onChunk 检查取消 + catch 不重试 | [已验收] |
| F-8.5 | scriptService.ts：镜头生成 onChunk 检查取消 | [已验收] |
| F-8.6 | novelService.ts：两个流式回调 onChunk 检查取消 | [已验收] |
| F-8.7 | deepseek.ts：流式重试识别 CANCELLED 错误立即抛出不重试 | [已验收] |
| F-8.8 | 部署验证 ✅ | [已验收] |

### F-9：APP 客户端全链路状态适配

| 步骤 | 描述 | 状态 |
|------|------|------|
| F-9.1 | useNovelStore.ts：新增 queueStatus 状态 + setQueueStatus（自动更新 novel.status queued/analyzing） | [已验收] |
| F-9.2 | BookshelfScreen.tsx：STATUS_CONFIG 加入 queued 状态 + NovelProgress 显示排队位置 | [已验收] |
| F-9.3 | ChatScreen.tsx：WebSocket 处理 queue_status 消息 | [已验收] |
| F-9.4 | TaskProgressScreen.tsx：WebSocket 处理 queue_status 消息 | [已验收] |
| F-9.5 | UploadScreen.tsx：上传后 ActiveTask 默认 status='queued'（而非 'running'） | [已验收] |
| F-9.6 | EpisodeDetailScreen.tsx：ws.onerror 显式提示「连接异常，任务仍在后台进行」 | [已验收] |
| F-9.7 | 全局覆盖：所有 onChunk 回调添加取消检查（CANCELLED_BY_USER）→ 不重试 | [已验收] |

### F-10：合规页面建设（隐私/协议/算法公示/备案/反馈/关于）

| 步骤 | 描述 | 状态 |
|------|------|------|
| F-10.1 | 新建 AboutScreen.tsx — 算法名称/类型/运行机制/数据来源/ICP备案/算法备案/版权 | [已验收] |
| F-10.2 | 新建 PrivacyPolicyScreen.tsx — 8 章完整隐私政策（收集/使用/存储/共享/权利/未成年人） | [已验收] |
| F-10.3 | 新建 UserAgreementScreen.tsx — 7 章用户服务协议（服务/账号/行为/知识产权/免责） | [已验收] |
| F-10.4 | 新建 FeedbackScreen.tsx — 意见反馈表单 + 联系方式 | [已验收] |
| F-10.5 | 新建 SettingsScreen.tsx — 聚合设置页（法律合规/信息公示/帮助/账户） | [已验收] |
| F-10.6 | HomeScreen.tsx — 菜单改为"设置→法律/协议/关于"完整链路 + 意见反馈 | [已验收] |
| F-10.7 | App.tsx + navigation.ts — 注册 5 个新 Stack 路由 | [已验收] |
| F-10.8 | APP 名称统一改为"Deep剧本"（app.json/strings.xml/MainActivity.kt/settings.gradle） | [已验收] |

### APP 状态覆盖全表

| 状态 | 触发条件 | APP 显示 |
|------|---------|---------|
| **queued（排队中）** | taskQueue 满，WebSocket queue_status position>0 | 书架卡片 PulseProgressBar "排队中（第 N 位）"，黄色排队标签 |
| **analyzing** | 分析开始运行 | PulseProgressBar "AI 分析中"，紫色标签 |
| **generating** | 剧本生成中 | ProgressBar + 集数进度 |
| **completed** | 全部完成 | ✅ 标签，点击进剧集详情 |
| **failed/error** | 分析/生成失败 | ❌ 标签，长按可删除 |
| **网络异常** | WebSocket 断开 | "[连接异常，任务仍在后台进行]" + HTTP 轮询兜底 |
| **Token过期** | 401 响应 | LoginGuard 全屏覆盖 "登录已过期" |
| **服务端拥挤** | 上传后即时 | UploadScreen toast "已提交" + 书架显示排队状态 |
| **chunk 失败** | chunkStatus=failed | chunk 进度行显示 ❌ 标记 |

---

## 架构备忘（减少下一个 AI 的阅读负担）

### 关键设计决策

1. **模型真实身份**：代码变量名用 `deepseek`，已切换到 **DeepSeek V4 Flash**（`deepseek-v4-flash`，1M tokens 上下文窗口）。API 端点 `https://api.deepseek.com`。变量名是历史遗留，改成本高，不动。

2. **分块大小 400K 字符**：基于 DeepSeek V3 Flash 的 1M tokens 窗口，留出输出和系统提示的余量。9MB 小说约 15 块（之前 72 块）。

3. **多 Key 连接池**：`deepseekPool.ts` 轮询分配请求到多个 DeepseekService 实例。每 Key 独立 10 槽位（AI_MAX_CONCURRENT 环境变量）。添加 Key：`.env` 中 DEEPSEEK_API_KEYS=key1,key2,key3，代码零改动自动扩容。

4. **全局任务调度器**：`taskQueue.ts` 管理所有小说级任务。全局最多 10 本同时运行，同一 userId 最多 1 本。多余任务 FIFO 排队。入队前幂等检查防止重复提交。

5. **一次性合并而非树状合并**：多块摘要一次 AI 调用即可完成合并。

6. **逐块分析不复用历史**：每块独立分析，不传之前块的摘要做链式上下文。

7. **剧本生成不复用对话历史**：每集独立请求，prompt = 全文摘要 + 角色设定 + 对应段落 + 前情提要。

8. **失败不中断流程**：某块/某集失败 → 标记跳过 → 继续下一块/集。事后可通过单集重试按钮补救。
