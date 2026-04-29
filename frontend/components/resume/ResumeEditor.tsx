"use client";

import { useState } from "react";
import type { ResumeData, ResumeExperience } from "@/backend/lib/types";
import { cn } from "@/backend/lib/utils";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from "lucide-react";

interface ResumeEditorProps {
  data: ResumeData;
  onChange: (data: ResumeData) => void;
}

export function ResumeEditor({ data, onChange }: ResumeEditorProps) {
  const [expandedRole, setExpandedRole] = useState<number | null>(0);

  const update = (field: keyof ResumeData, value: unknown) => {
    onChange({ ...data, [field]: value });
  };

  const updateExperience = (index: number, field: keyof ResumeExperience, value: unknown) => {
    const exp = [...(data.experience || [])];
    exp[index] = { ...exp[index], [field]: value };
    update("experience", exp);
  };

  const updateBullet = (expIndex: number, bulletIndex: number, value: string) => {
    const exp = [...(data.experience || [])];
    const bullets = [...(exp[expIndex].bullets || [])];
    bullets[bulletIndex] = value;
    exp[expIndex] = { ...exp[expIndex], bullets };
    update("experience", exp);
  };

  const addBullet = (expIndex: number) => {
    const exp = [...(data.experience || [])];
    const bullets = [...(exp[expIndex].bullets || [])];
    if (bullets.length >= 3) return;
    bullets.push("");
    exp[expIndex] = { ...exp[expIndex], bullets };
    update("experience", exp);
  };

  const removeBullet = (expIndex: number, bulletIndex: number) => {
    const exp = [...(data.experience || [])];
    const bullets = exp[expIndex].bullets.filter((_, i) => i !== bulletIndex);
    exp[expIndex] = { ...exp[expIndex], bullets };
    update("experience", exp);
  };

  const addRole = () => {
    if ((data.experience || []).length >= 4) return;
    const exp = [...(data.experience || [])];
    exp.push({ company: "", role: "", startDate: "", endDate: "", bullets: [""] });
    update("experience", exp);
    setExpandedRole(exp.length - 1);
  };

  const removeRole = (index: number) => {
    const exp = (data.experience || []).filter((_, i) => i !== index);
    update("experience", exp);
    setExpandedRole(null);
  };

  const addSkill = () => {
    if ((data.skills || []).length >= 12) return;
    update("skills", [...(data.skills || []), ""]);
  };

  const updateSkill = (index: number, value: string) => {
    const skills = [...(data.skills || [])];
    skills[index] = value;
    update("skills", skills);
  };

  const removeSkill = (index: number) => {
    update("skills", (data.skills || []).filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 text-sm">
      {/* Personal Info */}
      <Section title="Personal Info">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full Name">
            <Input value={data.name || ""} onChange={(v) => update("name", v)} placeholder="Jane Doe" />
          </Field>
          <Field label="Title">
            <Input value={data.title || ""} onChange={(v) => update("title", v)} placeholder="Software Engineer" />
          </Field>
          <Field label="Email">
            <Input value={data.email || ""} onChange={(v) => update("email", v)} placeholder="jane@example.com" />
          </Field>
          <Field label="Phone">
            <Input value={data.phone || ""} onChange={(v) => update("phone", v)} placeholder="+1 (555) 000-0000" />
          </Field>
          <Field label="Location">
            <Input value={data.location || ""} onChange={(v) => update("location", v)} placeholder="San Francisco, CA" />
          </Field>
          <Field label="LinkedIn">
            <Input value={data.linkedin || ""} onChange={(v) => update("linkedin", v)} placeholder="linkedin.com/in/..." />
          </Field>
        </div>
        <Field label="Summary (2 sentences max)">
          <textarea
            value={data.summary || ""}
            onChange={(e) => update("summary", e.target.value)}
            rows={2}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none text-sm"
            placeholder="Experienced engineer with..."
          />
        </Field>
      </Section>

      {/* Experience */}
      <Section
        title={`Experience (${(data.experience || []).length}/4)`}
        action={
          (data.experience || []).length < 4 && (
            <button onClick={addRole} className="flex items-center gap-1 text-violet-400 hover:text-violet-300 text-xs">
              <Plus size={12} /> Add Role
            </button>
          )
        }
      >
        <div className="space-y-2">
          {(data.experience || []).map((exp, i) => (
            <div key={i} className="border border-white/10 rounded-lg overflow-hidden">
              <div
                onClick={() => setExpandedRole(expandedRole === i ? null : i)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 text-left cursor-pointer"
              >
                <span className="text-white font-medium truncate">
                  {exp.role || exp.company || `Role ${i + 1}`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); removeRole(i); }}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <Trash2 size={12} />
                  </button>
                  {expandedRole === i ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </div>

              {expandedRole === i && (
                <div className="px-3 pb-3 space-y-3 border-t border-white/10 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Role/Title">
                      <Input value={exp.role} onChange={(v) => updateExperience(i, "role", v)} placeholder="Software Engineer" />
                    </Field>
                    <Field label="Company">
                      <Input value={exp.company} onChange={(v) => updateExperience(i, "company", v)} placeholder="Acme Corp" />
                    </Field>
                    <Field label="Start Date">
                      <Input value={exp.startDate} onChange={(v) => updateExperience(i, "startDate", v)} placeholder="Jan 2022" />
                    </Field>
                    <Field label="End Date">
                      <Input value={exp.endDate} onChange={(v) => updateExperience(i, "endDate", v)} placeholder="Present" />
                    </Field>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-gray-400 text-xs">Bullets ({(exp.bullets || []).length}/3, max 14 words each)</label>
                      {(exp.bullets || []).length < 3 && (
                        <button onClick={() => addBullet(i)} className="text-violet-400 hover:text-violet-300 text-xs flex items-center gap-1">
                          <Plus size={10} /> Add
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {(exp.bullets || []).map((bullet, j) => (
                        <div key={j} className="flex items-start gap-2">
                          <textarea
                            value={bullet}
                            onChange={(e) => updateBullet(i, j, e.target.value)}
                            rows={2}
                            className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none text-xs"
                            placeholder="Achieved X by doing Y, resulting in Z"
                          />
                          <button onClick={() => removeBullet(i, j)} className="text-red-400 hover:text-red-300 mt-1">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Skills */}
      <Section
        title={`Skills (${(data.skills || []).length}/12)`}
        action={
          (data.skills || []).length < 12 && (
            <button onClick={addSkill} className="flex items-center gap-1 text-violet-400 hover:text-violet-300 text-xs">
              <Plus size={12} /> Add
            </button>
          )
        }
      >
        <div className="flex flex-wrap gap-2">
          {(data.skills || []).map((skill, i) => (
            <div key={i} className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-3 py-1">
              <input
                value={skill}
                onChange={(e) => updateSkill(i, e.target.value)}
                className="bg-transparent text-white text-xs w-20 focus:outline-none"
                placeholder="Skill"
              />
              <button onClick={() => removeSkill(i)} className="text-gray-500 hover:text-red-400">
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* Education */}
      <Section title="Education">
        {(data.education || []).map((edu, i) => (
          <div key={i} className="grid grid-cols-3 gap-3 mb-2">
            <Field label="Institution">
              <Input
                value={edu.institution}
                onChange={(v) => {
                  const ed = [...(data.education || [])];
                  ed[i] = { ...ed[i], institution: v };
                  update("education", ed);
                }}
                placeholder="MIT"
              />
            </Field>
            <Field label="Degree">
              <Input
                value={edu.degree}
                onChange={(v) => {
                  const ed = [...(data.education || [])];
                  ed[i] = { ...ed[i], degree: v };
                  update("education", ed);
                }}
                placeholder="B.S. Computer Science"
              />
            </Field>
            <Field label="Year">
              <Input
                value={edu.year}
                onChange={(v) => {
                  const ed = [...(data.education || [])];
                  ed[i] = { ...ed[i], year: v };
                  update("education", ed);
                }}
                placeholder="2022"
              />
            </Field>
          </div>
        ))}
        {(data.education || []).length === 0 && (
          <button
            onClick={() => update("education", [{ institution: "", degree: "", year: "" }])}
            className="text-violet-400 hover:text-violet-300 text-xs flex items-center gap-1"
          >
            <Plus size={12} /> Add Education
          </button>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-gray-400 text-xs mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 text-sm"
    />
  );
}
