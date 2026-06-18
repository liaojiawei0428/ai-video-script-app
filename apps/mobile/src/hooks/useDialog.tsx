/**
 * useDialog hook v1.0 (v3.0.24 S60 重构)
 *
 * 全局弹窗控制 hook
 * 模块级 store, 无需 Provider 嵌套
 *
 * 用法 (替换 Alert.alert / Modal):
 *   const { showAlert, showConfirm, showCustom } = useDialog();
 *   showAlert('保存成功', '个人信息已更新');
 *   showConfirm({ title: '确定删除?', onConfirm: () => {...} });
 *   showCustom({ title: '图片预览', content: <Image /> });
 */

import { useCallback } from 'react';
import { toast, ToastVariant } from '../components/Toast';
import type { DialogVariant } from '../components/Dialog';

export interface AlertOptions {
  title?: string;
  message: string;
  variant?: DialogVariant;
  confirmText?: string;
  onConfirm?: () => void;
}

export interface ConfirmOptions {
  title?: string;
  message?: string;
  variant?: DialogVariant;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface CustomDialogOptions {
  title?: string;
  content: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  dismissable?: boolean;
}

type DialogConfig =
  | { type: 'alert'; options: AlertOptions }
  | { type: 'confirm'; options: ConfirmOptions }
  | { type: 'custom'; options: CustomDialogOptions }
  | null;

type Listener = (cfg: DialogConfig) => void;

class DialogStoreImpl {
  private listeners: Listener[] = [];
  private _config: DialogConfig = null;
  get config() { return this._config; }
  on(fn: Listener) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }
  show(cfg: DialogConfig) {
    this._config = cfg;
    this.listeners.forEach(l => l(cfg));
  }
  close() {
    this._config = null;
    this.listeners.forEach(l => l(null));
  }
}

export const DialogStore = new DialogStoreImpl();

export function useDialog() {
  const showAlert = useCallback((opts: AlertOptions | string) => {
    const options: AlertOptions = typeof opts === 'string' ? { message: opts } : opts;
    DialogStore.show({ type: 'alert', options });
  }, []);

  const showConfirm = useCallback((opts: ConfirmOptions) => {
    DialogStore.show({ type: 'confirm', options: opts });
  }, []);

  const showCustom = useCallback((opts: CustomDialogOptions) => {
    DialogStore.show({ type: 'custom', options: opts });
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant = 'default', description?: string) => {
    toast.show({ message, variant, description });
  }, []);

  const closeDialog = useCallback(() => {
    DialogStore.close();
  }, []);

  /**
   * alert 简写 (兼容 Alert.alert 1/2/3/4 参数签名)
   * alert(title, message?, buttons?, options?)
   */
  const alert = useCallback((title: string, message?: string, _buttons?: any[], _options?: any) => {
    DialogStore.show({ type: 'alert', options: { title, message: message || '' } });
  }, []);

  return {
    showAlert,
    showConfirm,
    showCustom,
    showToast,
    closeDialog,
    alert,
  };
}

// 快捷 toast 函数
export { toast };

/**
 * 模块级 alert 简写 (替代 Alert.alert, 兼容 2/3/4 参数)
 * alert(title, message?) - 单按钮 OK
 * alert(title, message, buttons) - 多按钮 (buttons[0] 默认 confirm, 其他为 secondary)
 *
 * 用法:
 *   import { alert } from '../hooks/useDialog';
 *   alert('错误', '出错了');
 *   alert('确定删除?', '删除后无法恢复', [{text: '取消', style: 'cancel'}, {text: '删除', onPress: handleDelete}]);
 */
export function alert(title: string, message?: string, buttons?: Array<{ text?: string; onPress?: () => void; style?: 'cancel' | 'default' | 'destructive' }>, _options?: any) {
  if (!buttons || buttons.length === 0) {
    DialogStore.show({ type: 'alert', options: { title, message: message || '' } });
    return;
  }
  if (buttons.length === 1) {
    DialogStore.show({
      type: 'alert',
      options: {
        title,
        message: message || '',
        confirmText: buttons[0].text,
        onConfirm: buttons[0].onPress,
      },
    });
    return;
  }
  // 多按钮: 第一个 = cancel, 最后一个 = confirm
  const cancelBtn = buttons.find(b => b.style === 'cancel') || buttons[0];
  const confirmBtn = buttons.find(b => b !== cancelBtn) || buttons[buttons.length - 1];
  // 其他按钮: 暂时 ignore (Alert.alert 支持 N 按钮, Dialog 仅支持 2)
  DialogStore.show({
    type: 'confirm',
    options: {
      title,
      message: message || '',
      cancelText: cancelBtn.text,
      confirmText: confirmBtn.text,
      onCancel: cancelBtn.onPress,
      onConfirm: confirmBtn.onPress || (() => {}),
    },
  });
}

// DialogHost: App.tsx 挂载, 监听 store
export function DialogHost() {
  const React = require('react') as typeof import('react');
  const { Dialog } = require('../components/Dialog');
  const [cfg, setCfg] = React.useState<DialogConfig>(DialogStore.config);

  React.useEffect(() => {
    return DialogStore.on(setCfg);
  }, []);

  if (!cfg) return null;

  if (cfg.type === 'alert') {
    const { options } = cfg;
    return (
      <Dialog
        visible={true}
        onClose={DialogStore.close.bind(DialogStore)}
        title={options.title}
        message={options.message}
        variant={options.variant}
        confirmText={options.confirmText}
        type="alert"
        onConfirm={options.onConfirm}
      />
    );
  }

  if (cfg.type === 'confirm') {
    const { options } = cfg;
    return (
      <Dialog
        visible={true}
        onClose={() => {
          options.onCancel?.();
          DialogStore.close();
        }}
        title={options.title}
        message={options.message}
        variant={options.variant}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        type="confirm"
        onConfirm={options.onConfirm}
        onCancel={options.onCancel}
      />
    );
  }

  if (cfg.type === 'custom') {
    const { options } = cfg;
    return (
      <Dialog
        visible={true}
        onClose={() => {
          options.onCancel?.();
          DialogStore.close();
        }}
        title={options.title}
        type="custom"
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        onConfirm={options.onConfirm}
        onCancel={options.onCancel}
        dismissable={options.dismissable}
      >
        {options.content}
      </Dialog>
    );
  }

  return null;
}
