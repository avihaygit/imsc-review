# הקול של ה-AI בעברית: איך מייצרים אותו שוב

את הקול הזה בחרנו לפתיחה של ההרצאה ״מהפכת הבינה״ (אוקטובר 2026). זה המתכון המדויק, כדי שאפשר יהיה להשתמש בו שוב גם בפרויקטים אחרים.

## ההגדרות

| מה | ערך |
|---|---|
| שירות | Higgsfield, דרך החיבור (MCP) של Higgsfield ב-Claude |
| מנוע | ElevenLabs Eleven v4 (`model: elevenlabs_v4`) |
| קול | Julian, קול גברי מובנה (`voice_type: preset`) |
| מזהה הקול | `95429266-c0ac-4137-a209-63b8812b0f23` |
| stability / similarity_boost | לא הוגדרו (ברירת המחדל של ElevenLabs) |
| עלות | כ-1.6 קרדיטים להקלטה של פסקה אחת (כ-80 מילים) |
| פורמט | MP3 |

## הבקשה עצמה

```json
{
  "model": "elevenlabs_v4",
  "prompt": "Hebrew intro, male voice Julian",
  "dialogue": [
    {
      "text": "בוקר טוב. אני לא בן אדם. ...",
      "voice_type": "preset",
      "voice_id": "95429266-c0ac-4137-a209-63b8812b0f23"
    }
  ]
}
```

בכלים של Higgsfield: `generate_audio` (הקלטה אחת) או `generate_audio_batch` (כמה הקלטות בבת אחת), ואחר כך `jobs_wait` כדי לקבל את קישור ה-MP3.

## מה עבד בכתיבת הטקסט

- עברית רגילה, בלי ניקוד. הקול קרא אותה טוב.
- משפטים קצרים. נקודה יוצרת עצירה קצרה, ושלוש נקודות (״לפחות... ככה נראה לי״) יוצרות הפסקה דרמטית.
- כל הקלטה יוצאת קצת אחרת, גם עם אותו טקסט ואותו קול. כדאי לייצר 2 הקלטות ולבחור.
- אם יש מילה שהקול הוגה לא נכון, אפשר לנקד רק אותה.

## ההקלטות של ההרצאה

- הקלטה 1, ״בוקר טוב״ (בשימוש במצגת): https://d8j0ntlcm91z4.cloudfront.net/user_3JwPqPlFZMwWGo5yb9sYlm4It59/hf_20261021_214008_cd2ceeb4-fe76-4588-bf71-4a5b0b53b666.mp3
- הקלטה 2, ״בוקר טוב״: https://d8j0ntlcm91z4.cloudfront.net/user_3JwPqPlFZMwWGo5yb9sYlm4It59/hf_20261021_214007_b32c6bc1-cdf7-4d92-a1c2-4dd92d187b69.mp3
- ההקלטה המקורית שנבחרה, ״ערב טוב״: https://d8j0ntlcm91z4.cloudfront.net/user_3JwPqPlFZMwWGo5yb9sYlm4It59/hf_20261021_210731_3ad61225-de8e-461b-a3b0-042deb2b0713.mp3

עותקים מקומיים במאגר: `ai-revolution-lecture/deck/audio/intro-morning-1.mp3` ו-`intro-morning-2.mp3` (כ-26 שניות כל אחת).

## הוראה ל-Claude בשיחה הבאה

״תשתמש בקול ה-AI מהקובץ ai-voice.md במאגר avihaygit/imsc-review״. כל מה שצריך כדי להקליט שוב באותו קול נמצא כאן.
