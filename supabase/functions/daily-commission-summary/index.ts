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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting daily commission summary...');

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Get all agents
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id, user_id, profiles(full_name)');

    if (agentsError) {
      console.error('Error fetching agents:', agentsError);
      throw agentsError;
    }

    console.log(`Processing ${agents?.length || 0} agents...`);

    let notificationsSent = 0;

    // For each agent, check if they have manager-recorded payments today
    for (const agent of agents || []) {
      const { data: collections, error: collectionsError } = await supabase
        .from('collections')
        .select('amount, commission, tenant_id, tenants!inner(tenant_name)')
        .eq('agent_id', agent.id)
        .eq('created_by_manager', true)
        .eq('status', 'verified')
        .eq('collection_date', today);

      if (collectionsError) {
        console.error(`Error fetching collections for agent ${agent.id}:`, collectionsError);
        continue;
      }

      if (!collections || collections.length === 0) {
        continue; // No manager payments today, skip
      }

      // Calculate total commission
      const totalCommission = collections.reduce((sum, col) => sum + (col.commission || 0), 0);
      const totalAmount = collections.reduce((sum, col) => sum + (col.amount || 0), 0);
      const paymentCount = collections.length;

      // Send summary notification
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          sender_id: agent.user_id, // System notification
          recipient_id: agent.user_id,
          title: '🎯 Daily Commission Summary',
          message: `Great work today! Managers recorded ${paymentCount} payment${paymentCount > 1 ? 's' : ''} on your behalf.

💰 Total Commission Earned Today: UGX ${totalCommission.toLocaleString()}
📊 Total Payments Processed: UGX ${totalAmount.toLocaleString()}
📈 Average Commission per Payment: UGX ${Math.round(totalCommission / paymentCount).toLocaleString()}

${collections.length <= 3 ? '\nPayments:\n' + collections.map(c => `• ${(c.tenants as any)?.tenant_name || 'Tenant'}: UGX ${c.commission.toLocaleString()}`).join('\n') : ''}

Keep up the excellent work! 🚀`,
          priority: 'normal',
          read: false,
        });

      if (notificationError) {
        console.error(`Error sending notification to agent ${agent.id}:`, notificationError);
      } else {
        notificationsSent++;
        console.log(`Sent summary to agent ${agent.id} (${(agent.profiles as any)?.full_name}): ${paymentCount} payments, UGX ${totalCommission.toLocaleString()} commission`);
      }
    }

    console.log(`Daily commission summary complete. Sent ${notificationsSent} notifications.`);

    return new Response(
      JSON.stringify({
        success: true,
        agentsProcessed: agents?.length || 0,
        notificationsSent,
        date: today,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in daily-commission-summary:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
