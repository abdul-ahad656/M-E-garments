export type AdminSessionGate = {
  isSignedIn: boolean;
  isSuccess: boolean;
  isError: boolean;
  authorized: boolean | undefined;
};

export function canRenderAdminWorkspace(session: AdminSessionGate): boolean {
  return (
    session.isSignedIn &&
    session.isSuccess &&
    !session.isError &&
    session.authorized === true
  );
}