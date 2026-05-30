import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radii, typography } from '../theme';

export function PrivacyPolicyScreen(): React.JSX.Element {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>隐私政策</Text>
      <Text style={styles.updateDate}>更新日期：2026年5月24日</Text>
      <Text style={styles.updateDate}>生效日期：2026年5月24日</Text>

      <Text style={styles.desc}>
        Deep剧本（以下简称"我们"）深知个人信息对您的重要性，我们将按照法律法规的要求，
        采取相应的安全保护措施，尽力保护您的个人信息安全可控。本隐私政策旨在向您说明
        我们如何收集、使用、存储和保护您的个人信息，以及您享有的相关权利。
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一、我们收集的信息</Text>
        <Text style={styles.desc}>
          在您使用Deep剧本的过程中，我们可能收集以下信息：{'\n\n'}
          <Text style={styles.bold}>1.1 账号信息</Text>{'\n'}
          当您注册账号时，我们会收集您的用户名、密码（加密存储）、电子邮箱地址（选填）。
          这些信息用于创建和管理您的账号。{'\n\n'}
          <Text style={styles.bold}>1.2 内容数据</Text>{'\n'}
          您上传的小说文件（TXT/EPUB/DOCX格式）、生成的剧本内容、角色分析等数据。
          这些数据仅用于为您提供AI剧本生成服务。{'\n\n'}
          <Text style={styles.bold}>1.3 设备信息</Text>{'\n'}
          我们可能会收集您的设备型号、操作系统版本、应用版本号等基础设备信息，
          用于优化服务体验和排查技术问题。{'\n\n'}
          <Text style={styles.bold}>1.4 日志信息</Text>{'\n'}
          当您使用我们的服务时，系统会自动记录请求日志，包括IP地址、访问时间、
          操作类型等，用于服务监控和安全防护。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>二、信息的使用目的</Text>
        <Text style={styles.desc}>
          我们收集的信息将用于以下目的：{'\n\n'}
          1. 提供核心AI剧本生成服务：将您上传的小说文本提交至大语言模型进行分析和剧本生成。{'\n'}
          2. 账号管理：处理注册、登录、密码修改等账号相关操作。{'\n'}
          3. 服务优化：分析服务使用情况，改进产品质量和用户体验。{'\n'}
          4. 安全防护：检测和防范安全威胁、欺诈等非法活动。{'\n'}
          5. 法律合规：满足法律法规、政府监管的要求。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>三、信息的存储和保护</Text>
        <Text style={styles.desc}>
          <Text style={styles.bold}>3.1 存储位置</Text>{'\n'}
          您的数据存储在阿里云RDS数据库（中国大陆境内服务器）。我们会采取合理
          的安全措施保护您的个人信息，防止数据遭到未经授权的访问、公开披露、使用、
          修改或损坏。{'\n\n'}
          <Text style={styles.bold}>3.2 存储期限</Text>{'\n'}
          您的账号信息在您注销账号前持续保存。上传的小说文件和生成的剧本内容
          在您主动删除或账号注销后即时清除。{'\n\n'}
          <Text style={styles.bold}>3.3 安全措施</Text>{'\n'}
          · 数据加密传输（HTTPS/SSL）{'\n'}
          · 密码哈希加密存储（bcrypt）{'\n'}
          · JWT Token身份验证{'\n'}
          · 数据库访问权限控制{'\n'}
          · 定期安全审查
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>四、信息的共享与披露</Text>
        <Text style={styles.desc}>
          我们不会将您的个人信息出售给第三方。以下情况除外：{'\n\n'}
          1. <Text style={styles.bold}>AI服务提供商</Text>：
          为提供剧本生成服务，我们会将您上传的小说文本（非个人信息）提交至第三方大语言模型API
          （DeepSeek）。该传输仅用于本次生成任务，API提供商不会将您的数据用于模型训练。{'\n'}
          2. <Text style={styles.bold}>法律要求</Text>：
          根据法律、法规或政府部门的要求，我们可能需要披露您的个人信息。{'\n'}
          3. <Text style={styles.bold}>保护权益</Text>：
          为保护我们、用户或公众的合法权益免受损害。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>五、您的权利</Text>
        <Text style={styles.desc}>
          根据相关法律法规，您享有以下权利：{'\n\n'}
          1. <Text style={styles.bold}>访问权</Text>：您可以随时查看您的个人信息。{'\n'}
          2. <Text style={styles.bold}>更正权</Text>：您可以修改您的昵称等个人信息。{'\n'}
          3. <Text style={styles.bold}>删除权</Text>：您可以删除已上传的小说和生成的剧本。{'\n'}
          4. <Text style={styles.bold}>注销权</Text>：您可以注销您的账号。注销后，您的所有数据将被永久删除。{'\n'}
          5. <Text style={styles.bold}>撤回同意权</Text>：您可以通过注销账号撤回对隐私政策的同意。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>六、未成年人保护</Text>
        <Text style={styles.desc}>
          本应用不面向14周岁以下的儿童提供服务。如果您是未成年人，
          请在监护人同意和指导下使用本应用。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>七、隐私政策更新</Text>
        <Text style={styles.desc}>
          我们可能会适时更新本隐私政策。更新后的政策将在应用内发布，
          并于发布时生效。重大变更我们将通过应用内通知的方式告知您。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>八、联系我们</Text>
        <Text style={styles.desc}>
          如您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：{'\n\n'}
          邮箱：support@maque.uno{'\n'}
          地址：请在App内"意见反馈"页面提交
        </Text>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.md },
  pageTitle: { ...typography.h1, marginBottom: spacing.xs },
  updateDate: { ...typography.caption, color: colors.text.tertiary, marginBottom: spacing.xs },
  section: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  sectionTitle: { ...typography.h2, color: colors.accent, marginBottom: spacing.sm },
  desc: { ...typography.body, color: colors.text.tertiary, lineHeight: 22 },
  bold: { fontWeight: '700', color: colors.text.secondary },
});
