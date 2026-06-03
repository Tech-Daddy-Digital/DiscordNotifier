export function renderAdminShell(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PulseDaddy Admin</title>
  <style>
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #0f1020; color: #f8fafc; }
    header { padding: 2rem; background: linear-gradient(135deg, #7c3aed, #db2777); }
    main { max-width: 1100px; margin: 0 auto; padding: 2rem; }
    a, button { color: #fef3c7; }
    .card { background: #181a2f; border: 1px solid #312e81; border-radius: 14px; padding: 1rem; margin: 1rem 0; }
    input, select, textarea { width: 100%; box-sizing: border-box; margin: .25rem 0 .75rem; padding: .6rem; border-radius: 8px; border: 1px solid #475569; background: #020617; color: #f8fafc; }
    button { background: #7c3aed; border: 0; border-radius: 8px; padding: .65rem 1rem; cursor: pointer; }
    code { background: #020617; padding: .15rem .35rem; border-radius: 4px; }
  </style>
</head>
<body>
<header><h1>PulseDaddy Admin</h1><p>Discord OAuth, bot invite, guild routes, admin roles, and monitored sources.</p></header>
<main id="app">Loading…</main>
<script>
const app = document.querySelector('#app');
async function api(path, options = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function boot() {
  const session = await api('/api/session');
  if (!session.authenticated) {
    app.innerHTML = '<div class="card"><h2>Sign in</h2><p>Use Discord to manage servers where you own the guild, have Administrator/Manage Server, or have a configured PulseDaddy admin role.</p><p><a href="/auth/login"><button>Login with Discord</button></a> <a href="/invite"><button>Add PulseDaddy to a server</button></a></p></div>';
    return;
  }
  const guilds = await api('/api/guilds');
  app.innerHTML = '<p>Signed in as <strong>' + session.user.username + '</strong>. <a href="/auth/logout">Logout</a></p><p><a href="/invite">Add PulseDaddy to another server</a></p><h2>Your manageable guilds</h2>' + guilds.guilds.map(g => '<div class="card"><h3>' + g.name + '</h3><p><a href="/admin/guilds/' + g.id + '">Manage settings</a></p></div>').join('');
}
boot().catch(err => { app.innerHTML = '<pre>' + err.message + '</pre>'; });
</script>
</body>
</html>`;
}

export function renderGuildAdminShell(guildId: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PulseDaddy Guild Admin</title><style>body{font-family:system-ui;background:#0f1020;color:#f8fafc;margin:0}main{max-width:1100px;margin:auto;padding:2rem}.card{background:#181a2f;border:1px solid #312e81;border-radius:14px;padding:1rem;margin:1rem 0}input,select,textarea{width:100%;box-sizing:border-box;margin:.25rem 0 .75rem;padding:.6rem;border-radius:8px;border:1px solid #475569;background:#020617;color:#f8fafc}button{background:#7c3aed;color:#fef3c7;border:0;border-radius:8px;padding:.65rem 1rem}</style></head><body><main><p><a href="/admin">← Guild list</a></p><h1>Guild ${escapeHtml(guildId)}</h1><div id="app">Loading…</div></main><script>
const guildId=${JSON.stringify(guildId)}; const app=document.querySelector('#app');
async function api(path,options={}){const res=await fetch(path,{headers:{'Content-Type':'application/json'},...options});if(!res.ok)throw new Error(await res.text());return res.json();}
async function saveSettings(){await api('/api/guilds/'+guildId+'/settings',{method:'PUT',body:JSON.stringify({guildName:document.querySelector('#guildName').value,defaultChannelId:document.querySelector('#defaultChannelId').value||null,adminRoleIds:document.querySelector('#adminRoleIds').value.split(',').map(s=>s.trim()).filter(Boolean)})});boot();}
async function saveRoute(){await api('/api/guilds/'+guildId+'/routes',{method:'POST',body:JSON.stringify({name:document.querySelector('#routeName').value,channelId:document.querySelector('#routeChannel').value,pingRoleId:document.querySelector('#routePing').value||null,messageTemplate:document.querySelector('#routeTemplate').value})});boot();}
async function saveSource(){await api('/api/guilds/'+guildId+'/sources',{method:'POST',body:JSON.stringify({type:document.querySelector('#sourceType').value,displayName:document.querySelector('#sourceName').value,externalId:document.querySelector('#sourceExternal').value,url:document.querySelector('#sourceUrl').value||null,routeId:document.querySelector('#sourceRoute').value||null,enabled:true,config:{lifecycle:['scheduled','live','upload']}})});boot();}
async function delSource(id){await api('/api/guilds/'+guildId+'/sources/'+id,{method:'DELETE'});boot();}
async function boot(){const data=await api('/api/guilds/'+guildId); const c=data.configuration; app.innerHTML='<div class="card"><h2>Settings</h2><label>Name<input id="guildName" value="'+(c.settings?.guildName||data.guild.name)+'"></label><label>Default channel ID<input id="defaultChannelId" value="'+(c.settings?.defaultChannelId||'')+'"></label><label>PulseDaddy admin role IDs, comma separated<input id="adminRoleIds" value="'+c.adminRoleIds.join(', ')+'"></label><button onclick="saveSettings()">Save settings</button></div><div class="card"><h2>Discord channels</h2><pre>'+data.channels.map(ch=>ch.name+' — '+ch.id).join('\\n')+'</pre><h2>Roles</h2><pre>'+data.roles.map(r=>r.name+' — '+r.id).join('\\n')+'</pre></div><div class="card"><h2>Notification routes</h2>'+c.routes.map(r=>'<p><strong>'+r.name+'</strong> → <code>'+r.channelId+'</code>, ping <code>'+(r.pingRoleId||'none')+'</code><br>'+r.messageTemplate+'</p>').join('')+'<input id="routeName" placeholder="Route name"><input id="routeChannel" placeholder="Discord channel ID"><input id="routePing" placeholder="Optional ping role ID"><textarea id="routeTemplate">{{displayName}} has a new {{type}} event: {{title}}</textarea><button onclick="saveRoute()">Add route</button></div><div class="card"><h2>Monitored sources</h2>'+c.sources.map(s=>'<p><strong>'+s.displayName+'</strong> ('+s.type+') <button onclick="delSource(\\''+s.id+'\\')">Delete</button></p>').join('')+'<select id="sourceType"><option>youtube</option><option>twitch</option><option>kick</option><option>x</option><option>bluesky</option><option>instagram</option></select><input id="sourceName" placeholder="Display name"><input id="sourceExternal" placeholder="Channel handle / account id"><input id="sourceUrl" placeholder="Optional URL"><input id="sourceRoute" placeholder="Optional route ID"><button onclick="saveSource()">Add source</button></div>';}
boot().catch(err=>{app.innerHTML='<pre>'+err.message+'</pre>'});
</script></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] ?? char));
}
