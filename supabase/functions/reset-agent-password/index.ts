import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Check if user is manager or admin
    const { data: hasRole } = await supabaseClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'manager'
    });

    if (!hasRole) {
      throw new Error('Insufficient permissions');
    }

    const { agent_user_id, new_password } = await req.json();

    if (!agent_user_id || !new_password) {
      throw new Error('Missing required fields');
    }

    if (new_password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // Update password using admin client
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      agent_user_id,
      { password: new_password }
    );

    if (updateError) {
      throw updateError;
    }

    // Log the action in audit_logs
    await supabaseClient.from('audit_logs').insert({
      user_id: user.id,
      action: 'UPDATE',
      table_name: 'auth.users',
      record_id: agent_user_id,
      new_data: { action: 'password_reset' },
      changed_fields: ['password']
    });

    console.log(`Password reset successful for user ${agent_user_id} by manager ${user.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error resetting password:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
