import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Commit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  html_url: string;
}

interface ReleaseNotes {
  features: string[];
  fixes: string[];
  improvements: string[];
  chores: string[];
  other: string[];
}

function categorizeCommit(message: string): keyof ReleaseNotes {
  const lowerMessage = message.toLowerCase();
  
  // Check for conventional commit prefixes
  if (lowerMessage.startsWith('feat:') || lowerMessage.startsWith('feature:')) return 'features';
  if (lowerMessage.startsWith('fix:')) return 'fixes';
  if (lowerMessage.startsWith('improve:') || lowerMessage.startsWith('enhancement:') || lowerMessage.startsWith('refactor:')) return 'improvements';
  if (lowerMessage.startsWith('chore:') || lowerMessage.startsWith('docs:') || lowerMessage.startsWith('style:')) return 'chores';
  
  // Check for keywords in message
  if (lowerMessage.includes('add') || lowerMessage.includes('new') || lowerMessage.includes('implement')) return 'features';
  if (lowerMessage.includes('fix') || lowerMessage.includes('bug') || lowerMessage.includes('resolve')) return 'fixes';
  if (lowerMessage.includes('improve') || lowerMessage.includes('enhance') || lowerMessage.includes('update') || lowerMessage.includes('optimize')) return 'improvements';
  
  return 'other';
}

function formatCommitMessage(message: string): string {
  // Remove conventional commit prefix
  let formatted = message.replace(/^(feat|fix|feature|improve|enhancement|refactor|chore|docs|style):\s*/i, '');
  
  // Capitalize first letter
  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  
  // Remove trailing periods
  formatted = formatted.replace(/\.$/, '');
  
  // Take only first line if multi-line commit
  formatted = formatted.split('\n')[0];
  
  return formatted;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fromDate, toDate, owner, repo } = await req.json();
    
    if (!owner || !repo) {
      return new Response(
        JSON.stringify({ error: 'Repository owner and name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get GitHub token from secrets
    const githubToken = Deno.env.get('GITHUB_TOKEN');
    if (!githubToken) {
      return new Response(
        JSON.stringify({ 
          error: 'GitHub token not configured. Please add GITHUB_TOKEN secret in Lovable Cloud settings.',
          missingSecret: true 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build GitHub API URL with date filters
    let apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`;
    if (fromDate) apiUrl += `&since=${fromDate}`;
    if (toDate) apiUrl += `&until=${toDate}`;

    console.log('Fetching commits from GitHub:', apiUrl);

    // Fetch commits from GitHub
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Welile-App'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API error:', response.status, errorText);
      
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ error: 'Repository not found. Please check owner and repo names.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Invalid GitHub token. Please update GITHUB_TOKEN secret.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`GitHub API returned ${response.status}: ${errorText}`);
    }

    const commits: Commit[] = await response.json();
    console.log(`Found ${commits.length} commits`);

    // Categorize and format commits
    const releaseNotes: ReleaseNotes = {
      features: [],
      fixes: [],
      improvements: [],
      chores: [],
      other: []
    };

    for (const commit of commits) {
      const message = commit.commit.message;
      
      // Skip merge commits
      if (message.startsWith('Merge ')) continue;
      
      const category = categorizeCommit(message);
      const formatted = formatCommitMessage(message);
      
      releaseNotes[category].push(formatted);
    }

    // Generate formatted markdown
    let markdown = '';
    
    if (releaseNotes.features.length > 0) {
      markdown += '## ✨ New Features\n\n';
      releaseNotes.features.forEach(item => {
        markdown += `- ${item}\n`;
      });
      markdown += '\n';
    }
    
    if (releaseNotes.improvements.length > 0) {
      markdown += '## 🚀 Improvements\n\n';
      releaseNotes.improvements.forEach(item => {
        markdown += `- ${item}\n`;
      });
      markdown += '\n';
    }
    
    if (releaseNotes.fixes.length > 0) {
      markdown += '## 🐛 Bug Fixes\n\n';
      releaseNotes.fixes.forEach(item => {
        markdown += `- ${item}\n`;
      });
      markdown += '\n';
    }
    
    if (releaseNotes.chores.length > 0) {
      markdown += '## 🔧 Maintenance\n\n';
      releaseNotes.chores.forEach(item => {
        markdown += `- ${item}\n`;
      });
      markdown += '\n';
    }
    
    if (releaseNotes.other.length > 0) {
      markdown += '## 📝 Other Changes\n\n';
      releaseNotes.other.forEach(item => {
        markdown += `- ${item}\n`;
      });
      markdown += '\n';
    }

    return new Response(
      JSON.stringify({
        success: true,
        commitCount: commits.length,
        releaseNotes,
        markdown,
        dateRange: {
          from: fromDate || commits[commits.length - 1]?.commit.author.date,
          to: toDate || commits[0]?.commit.author.date
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating release notes:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to generate release notes',
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});