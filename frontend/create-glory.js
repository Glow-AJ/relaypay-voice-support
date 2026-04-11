const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local to avoid missing 'dotenv' error
const envPath = path.join(__dirname, '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  try {
    console.log('Cleaning up existing auth users...');
    const { data: users } = await supabase.auth.admin.listUsers();
    if(users && users.users) {
      const targetUser = users.users.find(u => u.email === 'toglowai@gmail.com');
      if (targetUser) {
        console.log('Deleting existing auth user...', targetUser.id);
        await supabase.auth.admin.deleteUser(targetUser.id);
      }
    }

    console.log('Creating fresh auth user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'toglowai@gmail.com',
      password: 'Success2004',
      email_confirm: true,
      user_metadata: { name: 'Glory' }
    });

    if (authError) {
      console.error('Failed to create auth user:', authError);
      return;
    }

    const userId = authData.user.id;
    console.log('Auth user created with ID:', userId);

    console.log('Upserting agents table...');
    const { error: agentsError } = await supabase
      .from('agents')
      .upsert({
        email: 'toglowai@gmail.com',
        name: 'Glory',
        role: 'support',
        is_available: true,
        invite_status: 'accepted',
        user_id: userId
      }, { onConflict: 'email' });

    if (agentsError) {
      console.error('Failed to update agents table:', agentsError);
    } else {
      console.log('Agent Glory successfully fully configured and ready!');
    }
  } catch (e) {
    console.error('Error in script', e);
  }
}

run();
