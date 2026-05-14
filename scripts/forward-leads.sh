#!/usr/bin/env bash
# Forward new mvpilot leads to WeChat via OpenClaw Gateway
# Runs as a cron job every 2 minutes
set -euo pipefail

ADMIN_TOKEN="changeme-authorization-token"
GATEWAY_TOKEN="d6a7427980e7d7e34c2c152effac0083b23eeff83dbd6099"
GATEWAY_URL="http://127.0.0.1:18789"
LEADS_URL="https://mvpilot.aipromptor.com/api/admin/leads"
STATE_FILE="/tmp/mvpilot-leads-state"
WECHAT_TO="o9cq801o1iHi07nt6t_II2ZBdOuE@im.wechat"

# Get last seen timestamp (default to 5 minutes ago so we catch recent ones)
LAST_SEEN="$(cat "$STATE_FILE" 2>/dev/null || date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"

# Fetch new leads
LEADS=$(curl -sf -H "x-admin-token: $ADMIN_TOKEN" "$LEADS_URL?since=$LAST_SEEN" 2>/dev/null || echo "[]")
LEN=$(echo "$LEADS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "0")

if [ "$LEN" = "0" ]; then
    # Update state to now so we don't re-fetch old ones
    date -u +%Y-%m-%dT%H:%M:%SZ > "$STATE_FILE"
    exit 0
fi

echo "Found $LEN new lead(s)"

# Process each lead
echo "$LEADS" | python3 -c "
import json, sys, os

leads = json.load(sys.stdin)
gateway = os.environ.get('GATEWAY_URL', 'http://127.0.0.1:18789')
token = os.environ.get('GATEWAY_TOKEN', '')
wechat_to = os.environ.get('WECHAT_TO', '')

latest = leads[0]['notifiedAt'] if leads else ''

for lead in leads:
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
    
    # Send via Gateway /tools/invoke
    payload = json.dumps({
        'tool': 'sessions_send',
        'action': 'json',
        'args': {
            'sessionKey': f'openclaw-weixin:{wechat_to}',
            'message': msg
        }
    })
    
    result = os.system(f'''curl -sf -X POST '{gateway}/tools/invoke' \\
        -H 'Authorization: Bearer {token}' \\
        -H 'Content-Type: application/json' \\
        -d '{payload}' > /dev/null 2>&1''')
    
    if result == 0:
        print(f'  ✓ Forwarded lead {lead[\"id\"][:12]}...')
    else:
        print(f'  ✗ Failed to forward lead {lead[\"id\"][:12]}...')

# Update state to latest
if latest:
    os.system(f'echo \"{latest}\" > \"{os.environ.get(\"STATE_FILE\", \"/tmp/mvpilot-leads-state\")}\"')
" 2>&1 || true

# Fallback: always update state to now
date -u +%Y-%m-%dT%H:%M:%SZ > "$STATE_FILE"
