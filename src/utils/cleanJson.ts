export function cleanJson(text: string): string {
    return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}
