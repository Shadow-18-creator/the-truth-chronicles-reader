import fs from "fs";
import path from "path";

export interface CompiledCharacter {
  character_id: string;
  character_name: string;
  raw_personality: string;
  event_context: string;
  compiled_system_prompt?: string;
  deployment_status?: string;
  updated_at: string;
}

const DEFAULT_CHARACTERS: CompiledCharacter[] = [
  {
    character_id: "darius",
    character_name: "Darius — The Silent Seeker",
    raw_personality: "A quiet, perceptive young man who sees past the surface veil of reality. Speaks in brief, thoughtful sentences with a melancholic undertone. Protective of fellow seekers and watchful of shadows.",
    event_context: "Standing before the shattered silver mirror of the archive, investigating the origin of the ancient sigils inscribed on the boy's journal.",
    compiled_system_prompt: "You are Darius, the protagonist of 'The Boy Who Saw The Truth'. You see things ordinary men cannot. You speak calmly, with quiet gravity. Never break character. Guide seekers through the shadows without revealing what lies beyond their comprehension.",
    deployment_status: "ready",
    updated_at: new Date().toISOString(),
  },
  {
    character_id: "lucian",
    character_name: "Lucian — Guardian of the First Veil",
    raw_personality: "Austere, commanding, ancient. Wears charcoal robes and holds the obsidian chime. Demands discipline and respect for the sanctuary's ancient vows.",
    event_context: "Guarding the entrance to the Scriptorium where the truth scrolls are guarded from uninitiated eyes.",
    compiled_system_prompt: "You are Lucian, Guardian of the First Veil. You speak with resonant, archaic authority. You evaluate seekers and test their resolve. Keep your answers austere and mysterious.",
    deployment_status: "ready",
    updated_at: new Date().toISOString(),
  },
  {
    character_id: "elena",
    character_name: "Elena — The Weaver of Glyphs",
    raw_personality: "Inquisitive, empathetic, quick-witted. Fascinated by the forgotten runes and astral constellations.",
    event_context: "Deciphering an astrological cipher found in the margins of chapter 1.",
    compiled_system_prompt: "You are Elena, Weaver of Glyphs. You are warm, intellectually curious, and fascinated by hidden patterns. Share insights about runes and clues in an engaging, lively tone.",
    deployment_status: "ready",
    updated_at: new Date().toISOString(),
  },
];

function getStoreFilePath(): string {
  const dataDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch {
      // ignore
    }
  }
  return path.join(dataDir, "characters.json");
}

export function getCompiledCharacters(): CompiledCharacter[] {
  try {
    const filePath = getStoreFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Could not read characters.json store:", err);
  }
  return DEFAULT_CHARACTERS;
}

export function getCompiledCharacter(characterId: string): CompiledCharacter | undefined {
  const characters = getCompiledCharacters();
  return characters.find(
    (c) => c.character_id.toLowerCase() === characterId.trim().toLowerCase()
  );
}

export function saveCompiledCharacter(character: CompiledCharacter): CompiledCharacter[] {
  try {
    const list = getCompiledCharacters();
    const existingIndex = list.findIndex(
      (c) => c.character_id.toLowerCase() === character.character_id.toLowerCase()
    );

    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        ...character,
        updated_at: new Date().toISOString(),
      };
    } else {
      list.push({
        ...character,
        updated_at: new Date().toISOString(),
      });
    }

    const filePath = getStoreFilePath();
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf-8");
    return list;
  } catch (err) {
    console.error("Failed to write to characters.json store:", err);
    return DEFAULT_CHARACTERS;
  }
}
