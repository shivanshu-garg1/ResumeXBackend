function extractJsonObject(text) {
  // 1. Extract text inside ```json ... ```
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    text = fencedMatch[1].trim();
  }

  // 2. Extract first valid-looking JSON object
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (!objMatch) {
    throw new Error("No JSON object found in AI response");
  }

  return objMatch[0]; // Return JSON string
}

module.exports = extractJsonObject;
