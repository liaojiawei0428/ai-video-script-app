import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radii, typography } from '../theme';

export function UserAgreementScreen(): React.JSX.Element {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>用户服务协议</Text>
      <Text style={styles.updateDate}>更新日期：2026年5月24日</Text>

      <Text style={styles.desc}>
        欢迎使用Deep剧本（以下简称"本应用"）。在使用本应用前，请您仔细阅读本用户服务协议
        （以下简称"本协议"）。您开始使用本应用即表示您已阅读、理解并同意接受本协议的全部条款。
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一、服务说明</Text>
        <Text style={styles.desc}>
          Deep剧本是一款基于人工智能技术的剧本生成工具。用户上传小说文本后，
          系统调用大语言模型自动生成剧本分析报告、剧集剧本和分镜头脚本。{'\n\n'}
          本应用提供的AI生成内容仅供参考，不构成任何形式的专业建议。
          用户应自行判断生成内容的适用性和准确性。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>二、用户注册与账号</Text>
        <Text style={styles.desc}>
          2.1 您在使用本应用时，需要通过注册创建账号。{'\n'}
          2.2 您应当提供真实、准确、完整的注册信息。{'\n'}
          2.3 您应对账号下的所有活动承担责任。请妥善保管账号密码。{'\n'}
          2.4 未经他人许可，不得使用他人账号或转让账号给他人使用。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>三、用户行为规范</Text>
        <Text style={styles.desc}>
          您在使用本应用时，不得从事以下行为：{'\n\n'}
          1. 上传含有违法、违规、侵权、色情、暴力、恐怖等不良内容的小说文本。{'\n'}
          2. 利用生成内容制作、传播违法或不良信息。{'\n'}
          3. 干扰、破坏本应用的正常运行，包括但不限于利用自动化手段批量请求。{'\n'}
          4. 反向工程、破解或以其他方式获取本应用源代码。{'\n'}
          5. 利用本应用从事任何违反法律法规的活动。{'\n\n'}
          违反上述规定的，我们有权暂停或终止您的账号，并保留追究法律责任的权利。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>四、知识产权</Text>
        <Text style={styles.desc}>
          4.1 本应用的软件著作权、界面设计、交互逻辑等知识产权归麻雀逻辑所有。{'\n'}
          4.2 您上传的小说文本，其知识产权归您或原权利人所有。{'\n'}
          4.3 由AI生成的内容，其权利归属适用现行法律法规。本应用不对AI生成内容的
          原创性、合法性作出保证。{'\n'}
          4.4 未经许可，不得将本应用的整体或部分用于商业用途。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>五、免责声明</Text>
        <Text style={styles.desc}>
          5.1 本应用按"现状"提供服务，不对服务的及时性、安全性、准确性作任何明示或默示的保证。{'\n'}
          5.2 AI生成的内容可能存在不准确、不完整或不符合预期的情况，您应自行判断其适用性。{'\n'}
          5.3 因不可抗力、网络故障、第三方服务故障等原因导致的服务中断，我们不承担责任。{'\n'}
          5.4 您因使用或依赖AI生成内容而产生的任何损失，我们不承担法律责任。{'\n'}
          5.5 本应用保留随时修改、暂停或终止服务的权利。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>六、协议修改</Text>
        <Text style={styles.desc}>
          我们可能会适时修改本协议。修改后的协议将在应用内发布。如您继续使用本应用，
          即表示您同意修改后的协议。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>七、法律适用与争议解决</Text>
        <Text style={styles.desc}>
          本协议的订立、执行和解释均适用中华人民共和国法律。因本协议产生的争议，
          双方应友好协商解决；协商不成的，任何一方可向有管辖权的人民法院提起诉讼。
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
  updateDate: { ...typography.caption, color: colors.text.tertiary, marginBottom: spacing.md },
  section: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  sectionTitle: { ...typography.h2, color: colors.accent, marginBottom: spacing.sm },
  desc: { ...typography.body, color: colors.text.tertiary, lineHeight: 22 },
});
