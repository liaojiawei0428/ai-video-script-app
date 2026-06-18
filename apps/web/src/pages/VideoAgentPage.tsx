// v3.0.0.2: 视频 Agent 页面 (复用 AgentChatPanel)
// 视频暂不走"中文→英文"翻译流程 (per kind=video 简化, 视频 prompt 短, LLM 直接出英文 OK)
import { AgentChatPanel, type AgentApi } from '../components/AgentChatPanel';
import * as api from '../lib/api';

const videoAgentApi: AgentApi = {
  createConversation: api.videoAgentCreateConversationApi,
  chat: api.videoAgentChatApi,
  confirm: api.videoAgentConfirmApi,
  // translatePlan/updatePlanFields 故意不传, 走老的"plan_ready 直接确认"流程
  history: api.videoAgentHistoryApi,
  getById: api.videoAgentGetApi,
  deleteConversation: api.videoAgentDeleteApi,  // v3.0.0.17: 永久删除单条会话
};

export function VideoAgentPage() {
  return (
    <AgentChatPanel
      kind="video"
      api={videoAgentApi}
      title="视频助手"
      icon="video"
      accentColor="text-purple-500"
    />
  );
}
