#!/usr/bin/env bash
# Forward new mvpilot leads to WeChat via OpenClaw Gateway
# Runs as a cron job every 2 minutes
set -euo pipefail

# === Configuration ===
# LEADS_API_KEY — shared secret between this script and the deployed mvpilot worker
# Generate with: openssl rand -hex 16
LEADS_API_KEY="mvpilot-leads-key-2026"
GATEWAY_TOKEN="d6a7427980e7d7e34c2c152effac0083b23eeff83dbd6099"
GATEWAY_URL="http://127.0.0.1:18789"
LEADS_URL="https://mvpilot.aipromptor.com/api/admin/leads"
STATE_FILE="/tmp/mvpilot-leads-state"
WECHAT_TO="o9cq801o1iHi07nt6t_II2ZBdOuE@im.wechat"

# === Get last seen timestamp ===
LAST_SEEN="$(cat "$STATE_FILE" 2>/dev/null || date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"

# === Fetch new leads ===
LEADS=$(curl -sf "$LEADS_URL?key=$LEADS_API_KEY&since=$(echo -n "$LAST_SEEN" | python3 -c "import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read().strip()))")" 2>/dev/null || echo "[]")
LEN=$(echo "$LEADS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "0")

if [ "$LEN" = "0" ]; then
    date -u +%Y-%m-%dT%H:%M:%SZ > "$STATE_FILE"
    exit 0
fi

echo "[$(date -Iseconds)] Found $LEN new lead(s)"

# === Forward each lead to WeChat ===
echo "$LEADS" | python3 -c "
import json, sys, os, urllib.request

leads = json.load(sys.stdin)
gateway = os.environ.get('GATEWAY_URL', 'http://127.0.0.1:18789')
token = os.environ.get('GATEWAY_TOKEN', '')
wechat_to = os.environ.get('WECHAT_TO', '')
state_file = os.environ.get('STATE_FILE', '/tmp/mvpilot-leads-state')

latest = ''

for lead in leads:
    ts = lead.get('notifiedAt', '')
    if ts > latest: latest = ts
    
    plan = json.loads(lead.get('planJson') or 'null')
    
    msg = '🚀 **新 MVPilot 线索**\n\n'
    if plan:
        msg += f'💡 想法: {plan.get(\"problem\", \"?\")}\n'
        msg += f'👤 用户: {plan.get(\"user\", \"?\")}\n\n'
    
    if lead.get('contactEmail'):    msg += f'📧 Email: {lead[\"contactEmail\"]}\n'
    if lead.get('contactWechat'):   msg += f'💬 微信: {lead[\"contactWechat\"]}\n'
    if lead.get('contactTelegram'): msg += f'✈️ Telegram: {lead[\"contactTelegram\"]}\n'
    if lead.get('contactQq'):       msg += f'💬 QQ: {lead[\"contactQq\"]}\n'
    
    msg += f'\n🆔 Session: {lead[\"id\"]}'
    msg += f'\n🔗 https://mvpilot.aipromptor.com/chat/{lead[\"id\"]}'
    if lead.get('demoStatus') == 'ready':
        msg += f'\n🖥️ https://mvpilot.aipromptor.com/demo/{lead[\"id\"]}'
    
    # Send via Gateway /tools/invoke → sessions_send to openclaw-weixin
    payload = json.dumps({
        'tool': 'sessions_send',
        'action': 'json',
        'args': {
            'sessionKey': f'openclaw-weixin:{wechat_to}',
            'message': msg
        }
    }).encode('utf-8')
    
    req = urllib.request.Request(
        f'{gateway}/tools/invoke',
        data=payload,
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        },
        method='POST'
    )
    
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        print(f'  ✓ Forwarded lead {lead[\"id\"][:12]}...')
    except Exception as e:
        print(f'  ✗ Failed: {e}')

# Update state
if latest:
    with open(state_file, 'w') as f:
        f.write(latest + chr(10))
else:
    import subprocess, datetime
    now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    with open(state_file, 'w') as f:
        f.write(now + chr(10))
" 2>&1 || true

# Fallback: always update state to now
date -u +%Y-%m-%dT%H:%M:%SZ > "$STATE_FILE"
