import type { SkillManifest, ToolDefinition } from '@xclaw-ai/shared';
import type { ToolHandler } from '../tools/tool-registry.js';

export interface SkillDefinition {
  manifest: SkillManifest;
  tools: Array<{ definition: ToolDefinition; handler: ToolHandler }>;
  activate?: () => Promise<void>;
  deactivate?: () => Promise<void>;
}

export function defineSkill(skill: SkillDefinition): SkillDefinition {
  return skill;
}

export class SkillManager {
  private skills = new Map<string, SkillDefinition>();
  private activeSkills = new Set<string>();

  register(skill: SkillDefinition): void {
    this.skills.set(skill.manifest.name, skill);
  }

  async activate(name: string): Promise<void> {
    const skill = this.skills.get(name);
    if (!skill) throw new Error(`Skill "${name}" not found`);
    if (this.activeSkills.has(name)) return;

    if (skill.activate) await skill.activate();
    this.activeSkills.add(name);
  }

  async deactivate(name: string): Promise<void> {
    const skill = this.skills.get(name);
    if (!skill || !this.activeSkills.has(name)) return;

    if (skill.deactivate) await skill.deactivate();
    this.activeSkills.delete(name);
  }

  getActiveTools(): Array<{ definition: ToolDefinition; handler: ToolHandler }> {
    const tools: Array<{ definition: ToolDefinition; handler: ToolHandler }> = [];
    for (const name of this.activeSkills) {
      const skill = this.skills.get(name);
      if (skill) tools.push(...skill.tools);
    }
    return tools;
  }

  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  listSkills(): SkillManifest[] {
    return [...this.skills.values()].map((s) => s.manifest);
  }

  isActive(name: string): boolean {
    return this.activeSkills.has(name);
  }
}
