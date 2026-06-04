#!/bin/bash
# push-feature-branches.sh — يُحدّث الفروع على OculusEgypt بعد كل commit
# يُشغَّل بعد auto-commit النظام لإرسال التحسينات الجديدة إلى GitHub
#
# الاستخدام: bash push-feature-branches.sh
#
# الفروع:
#   feat/shared-utils-v4          — المكتبة المشتركة
#   feat/realtime-notifications-v4 — إشعارات WebSocket
#   feat/mission-control-v4        — مركز التحكم الموحد

set -e

if [ -z "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
  echo "❌ GITHUB_PERSONAL_ACCESS_TOKEN غير موجود"
  exit 1
fi

REMOTE="https://oculusegypt:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/oculusegypt/Agent-Assets.git"

echo "🚀 دفع الفروع إلى OculusEgypt/Agent-Assets..."

git push "$REMOTE" HEAD:main && echo "✅ main"
git push "$REMOTE" HEAD:feat/shared-utils-v4 && echo "✅ feat/shared-utils-v4"
git push "$REMOTE" HEAD:feat/realtime-notifications-v4 && echo "✅ feat/realtime-notifications-v4"
git push "$REMOTE" HEAD:feat/mission-control-v4 && echo "✅ feat/mission-control-v4"

echo ""
echo "✅ جميع الفروع مُحدَّثة على:"
echo "   https://github.com/oculusegypt/Agent-Assets"
