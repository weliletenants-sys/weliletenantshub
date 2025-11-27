import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Ensures that a user has a complete profile and associated records.
 * This is called after login to automatically create missing profiles.
 */
export async function ensureProfileExists(user: User): Promise<boolean> {
  try {
    // Check if profile exists
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileCheckError) {
      console.error('Error checking profile:', profileCheckError);
      return false;
    }

    // If profile exists, ensure user_roles and agent/manager record exists
    if (existingProfile) {
      const role = existingProfile.role;
      
      // Ensure user_roles entry exists
      const { data: userRoleExists } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', role)
        .maybeSingle();

      if (!userRoleExists) {
        console.log('Creating missing user_role for user:', user.id, 'role:', role);
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: user.id, role });

        if (roleError) {
          console.error('Error creating user_role:', roleError);
        }
      }
      
      if (role === 'agent') {
        const { data: agentExists } = await supabase
          .from('agents')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!agentExists) {
          console.log('Creating missing agent record for user:', user.id);
          const { error: agentError } = await supabase
            .from('agents')
            .insert({ user_id: user.id });

          if (agentError) {
            console.error('Error creating agent record:', agentError);
            return false;
          }
        }
      } else if (role === 'manager') {
        const { data: managerExists } = await supabase
          .from('service_centre_managers')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!managerExists) {
          console.log('Creating missing manager record for user:', user.id);
          const { error: managerError } = await supabase
            .from('service_centre_managers')
            .insert({ user_id: user.id });

          if (managerError) {
            console.error('Error creating manager record:', managerError);
            return false;
          }
        }
      }

      return true;
    }

    // Profile doesn't exist - create it from user metadata
    console.log('Creating missing profile for user:', user.id);
    
    const metadata = user.user_metadata;
    const role = (metadata?.role as 'agent' | 'manager' | 'admin') || 'agent';
    
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        phone_number: metadata?.phone_number || user.phone || user.email?.split('@')[0] || '',
        full_name: metadata?.full_name || '',
        role: role,
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      return false;
    }

    // Create user_roles entry
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: user.id, role });

    if (roleError) {
      console.error('Error creating user_role:', roleError);
      // Continue even if role creation fails
    }

    // Create corresponding agent or manager record
    if (role === 'agent') {
      const { error: agentError } = await supabase
        .from('agents')
        .insert({ user_id: user.id });

      if (agentError) {
        console.error('Error creating agent record:', agentError);
        return false;
      }
    } else if (role === 'manager') {
      const { error: managerError } = await supabase
        .from('service_centre_managers')
        .insert({ user_id: user.id });

      if (managerError) {
        console.error('Error creating manager record:', managerError);
        return false;
      }
    }

    console.log('Successfully created profile and role-specific record for user:', user.id);
    return true;
  } catch (error) {
    console.error('Unexpected error in ensureProfileExists:', error);
    return false;
  }
}
