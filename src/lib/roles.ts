export function isAdminGlobal(rol: string | null | undefined) {
  return rol === 'admin_global' || rol === 'superadmin';
}
