import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radii, typography } from '../theme';
import { APP_VERSION } from '../config/version';

export function AboutScreen(): React.JSX.Element {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>关于 Deep剧本</Text>

      {/* 基本信息 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>应用信息</Text>
        <InfoRow label="应用名称" value="Deep剧本" />
        <InfoRow label="版本号" value={'v' + APP_VERSION} />
        <InfoRow label="开发工作室" value="麻雀逻辑" />
        <InfoRow label="官方网站" value="maque.uno" />
        <InfoRow label="联系邮箱" value="378685504@qq.com" />
      </View>

      {/* 算法公示 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>算法备案公示</Text>
        <Text style={styles.desc}>
          根据《互联网信息服务深度合成管理规定》《互联网信息服务算法推荐管理规定》，
          本应用所使用的生成合成类算法已依法进行备案，现将相关信息公示如下：
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.subTitle}>算法基本情况</Text>
        <InfoRow label="算法名称" value="Deep剧本-深度合成内容生成算法" />
        <InfoRow label="算法类型" value="生成合成类（文本生成）" />
        <InfoRow label="应用场景" value="基于用户上传的小说文本，调用大语言模型自动生成剧本分析报告、剧集剧本和分镜头脚本" />
      </View>

      <View style={styles.section}>
        <Text style={styles.subTitle}>算法运行机制</Text>
        <Text style={styles.desc}>
          1. 用户上传小说文本后，系统对文本进行分段处理（Map阶段）。{'\n'}
          2. 每个文本片段独立调用大语言模型（DeepSeek V4 Flash）进行分析，提取角色、情节、主题等信息。{'\n'}
          3. 分段分析结果由合并模型进行汇总（Reduce阶段），生成全文摘要。{'\n'}
          4. 基于全文摘要和角色设定，逐集生成剧本内容。{'\n'}
          5. 对已生成的剧本进一步生成分镜头脚本。{'\n'}
          6. 各阶段采用独立请求模式，不累积对话历史，确保每轮输出的独立性和可控性。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.subTitle}>数据来源</Text>
        <Text style={styles.desc}>
          本应用使用的生成模型基于公开数据集进行训练。用户上传的小说文本仅用于本次生成任务，
          完成后可随时删除。系统不将用户内容用于模型训练或其他目的。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.subTitle}>技术特点</Text>
        <Text style={styles.desc}>
          · 基于大语言模型的文本理解与生成技术{'\n'}
          · 分块并行处理机制，支持百万字级长文本分析{'\n'}
          · 多Key轮询负载均衡，保证服务稳定性{'\n'}
          · 流式输出，实时展示生成进度{'\n'}
          · 失败自动重试与容错机制
        </Text>
      </View>

      {/* ICP备案 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>备案信息</Text>
        <InfoRow label="ICP备案号" value="待备案" />
        <InfoRow label="算法备案号" value="待备案" />
        <InfoRow label="公安联网备案号" value="待备案" />
        <Text style={styles.hint}>
          应用正在合规备案流程中，备案信息将在取得后即时更新。
        </Text>
      </View>

      {/* 版权信息 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>版权信息</Text>
        <Text style={styles.desc}>
          © 2026 麻雀逻辑 版权所有{'\n\n'}
          本应用及其相关内容（包括但不限于界面设计、交互逻辑、软件代码）的所有权
          及知识产权归麻雀逻辑所有，受《中华人民共和国著作权法》及相关法律法规保护。{'\n\n'}
          未经授权，任何组织或个人不得以任何形式复制、修改、发布或用于商业目的。{'\n\n'}
          用户利用本应用生成的内容，其权利归属由用户与相关权利人约定。
          本应用生成的内容仅供参考，用户对其使用方式自行承担责任。
        </Text>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.md },
  pageTitle: { ...typography.h1, marginBottom: spacing.lg },
  section: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.h2, color: colors.accent, marginBottom: spacing.sm },
  subTitle: { ...typography.h3, color: colors.text.secondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  desc: { ...typography.body, color: colors.text.tertiary, lineHeight: 22 },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoLabel: { ...typography.body, color: colors.text.tertiary, width: 100 },
  infoValue: { ...typography.body, color: colors.text.primary, flex: 1 },
  hint: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.sm, fontStyle: 'italic' },
});
