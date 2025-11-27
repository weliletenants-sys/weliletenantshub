import { supabase } from "@/integrations/supabase/client";

export type AppRole = 'admin' | 'manager' | 'agent';

/**
 * Get all roles for a user from user_roles table
 */
export const getUserRoles = async (userId: string): Promise<AppRole[]> => {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user roles:', error);
    return [];
  }

  return (data || []).map(r => r.role as AppRole);
};

/**
 * Check if user has a specific role
 */
export const hasRole = async (userId: string, role: AppRole): Promise<boolean> => {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', role)
    .maybeSingle();

  return !!data;
};

/**
 * Get primary role (first role, or 'agent' as default)
 */
export const getPrimaryRole = async (userId: string): Promise<AppRole> => {
  const roles = await getUserRoles(userId);
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('manager')) return 'manager';
  return 'agent';
};

/**
 * Add a role to a user (admin only)
 */
export const addUserRole = async (userId: string, role: AppRole): Promise<{ error?: any }> => {
  const { error } = await supabase
    .from('user_roles')
    .insert({ user_id: userId, role });

  return { error };
};

/**
 * Remove a role from a user (admin only)
 */
export const removeUserRole = async (userId: string, role: AppRole): Promise<{ error?: any }> => {
  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role', role);

  return { error };
};
