"use client";

import { createContext, useContext, useEffect } from "react";

type BackHandler = () => boolean;
type RegisterBackHandler = (handler: BackHandler | null) => void;

const AccountBackContext = createContext<RegisterBackHandler | null>(null);

export function AccountBackProvider({
  register,
  children,
}: {
  register: RegisterBackHandler;
  children: React.ReactNode;
}) {
  return <AccountBackContext.Provider value={register}>{children}</AccountBackContext.Provider>;
}

/**
 * 账户弹层二级视图返回栈：面板只在处于子视图且 tab 激活时注册。
 * 返回键/头部返回按钮优先回退子视图，没有子视图才关闭整个账户弹层。
 */
export function useAccountBackHandler(handler: BackHandler | null, enabled = true) {
  const register = useContext(AccountBackContext);
  useEffect(() => {
    if (!register || !enabled) return;
    register(handler);
    return () => register(null);
  }, [register, handler, enabled]);
}
