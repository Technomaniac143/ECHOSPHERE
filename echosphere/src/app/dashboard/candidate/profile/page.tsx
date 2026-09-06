"use client";

import { useEffect, useState, useCallback } from "react";
import { candidateApi } from "@/lib/api/client";
import type { CandidateProfile, SkillTag, Certificate } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { User, Mail, Phone, MapPin, Briefcase, Building2, Code, Link as LinkIcon, FileCode, Layers, Award, Upload, Plus, Trash2, Check, Loader2, Edit2, ChevronRight } from "lucide-react";

const EXPERIENCE_LEVELS = [
  "Fresher",
  "1-2 years",
  "3-5 years",
  "5-10 years",
  "10+ years",
];

const SKILL_CATEGORIES = [
  "Programming Languages",
  "Frameworks",
  "Databases",
  "Cloud Platforms",
  "Tools",
  "Other",
] as const;

const CATEGORY_KEYS: Record<string, "programming" | "framework" | "database" | "cloud" | "tool" | "other"> = {
  "Programming Languages": "programming",
  "Frameworks": "framework",
  "Databases": "database",
  "Cloud Platforms": "cloud",
  "Tools": "tool",
  "Other": "other",
};

export default function CandidateProfilePage() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [skills, setSkills] = useState<SkillTag[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillCategory, setNewSkillCategory] = useState("Programming Languages");
  const [savingCert, setSavingCert] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const [profRes, certRes] = await Promise.all([
        candidateApi.profile(),
        candidateApi.certificates?.(new FormData()) ?? Promise.resolve({ data: [] }),
      ]);
      setProfile(profRes.data);
      setSkills(
        ((profRes.data as any).skills as unknown as SkillTag[]) ??
        [
          { name: "JavaScript", category: "programming" },
          { name: "React", category: "framework" },
          { name: "Node.js", category: "programming" },
        ],
      );
      setCertificates((certRes as unknown as { data?: Certificate[] }).data ?? []);
    } catch {
      setProfile(null);
      setSkills([
        { name: "JavaScript", category: "programming" },
        { name: "React", category: "framework" },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async (fields: Partial<CandidateProfile>) => {
    setSaving(true);
    try {
      const res = await candidateApi.updateProfile(fields);
      setProfile(res.data);
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    if (!newSkillName.trim()) return;
    const categoryKey = CATEGORY_KEYS[newSkillCategory] ?? "other";
    setSkills((prev) => [...prev, { name: newSkillName.trim(), category: categoryKey }]);
    setNewSkillName("");
  };

  const removeSkill = (name: string) => {
    setSkills((prev) => prev.filter((s) => s.name !== name));
  };

  const handleCertificateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setSavingCert(file.name);
    try {
      const res = await candidateApi.certificates?.(fd);
      if (res && (res as unknown as { data?: Certificate }).data) {
        setCertificates((prev) => [
          ...prev,
          (res as unknown as { data: Certificate }).data,
        ]);
      }
    } catch (err) {
      console.error("Certificate upload failed:", err);
    } finally {
      setSavingCert(null);
    }
    e.target.value = "";
  };

  const removeCertificate = (id: string) => {
    setCertificates((prev) => prev.filter((c) => c.id !== id));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/80 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
        <span className="ml-2 text-sm text-slate-400">Loading profile…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/80">
      {/* Header */}
      <header className="border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/80 sticky top-0 z-40">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-800">Profile</h1>
              <p className="text-xs text-slate-500">Manage your candidate profile</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fetchProfile()}
          >
            <Edit2 className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        <Tabs defaultValue="personal" className="space-y-4">
          <TabsList>
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="career">Career</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="academic">Academic</TabsTrigger>
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
          </TabsList>

          {/* Personal */}
          <TabsContent value="personal" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4 text-violet-600" />
                  Personal Information
                </CardTitle>
                <CardDescription>Your basic contact details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={profile?.fullName ?? ""}
                      onChange={(e) =>
                        handleSave({ fullName: e.target.value })
                      }
                      placeholder="Your full name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile?.email ?? ""}
                      onChange={(e) =>
                        handleSave({ email: e.target.value })
                      }
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profile?.phone ?? ""}
                      onChange={(e) =>
                        handleSave({ phone: e.target.value })
                      }
                      placeholder="+1 234 567 890"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={profile?.location ?? ""}
                      onChange={(e) =>
                        handleSave({ location: e.target.value })
                      }
                      placeholder="City, State, Country"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => fetchProfile()}>
                  Reset
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Career */}
          <TabsContent value="career" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-violet-600" />
                  Career Goals
                </CardTitle>
                <CardDescription>Your target roles and career aspirations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="targetCompany">Target Company</Label>
                    <Input
                      id="targetCompany"
                      value={profile?.targetCompany ?? ""}
                      onChange={(e) =>
                        handleSave({ targetCompany: e.target.value })
                      }
                      placeholder="e.g. Google, Microsoft"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="targetRole">Target Role</Label>
                    <Input
                      id="targetRole"
                      value={profile?.targetRole ?? ""}
                      onChange={(e) =>
                        handleSave({ targetRole: e.target.value })
                      }
                      placeholder="e.g. Software Engineer"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="targetDomain">Domain</Label>
                    <Input
                      id="targetDomain"
                      value={profile?.targetDomain ?? ""}
                      onChange={(e) =>
                        handleSave({ targetDomain: e.target.value })
                      }
                      placeholder="e.g. Web Development"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="experienceLevel">Experience Level</Label>
                    <Select
                      value={profile?.experienceLevel ?? ""}
                      onValueChange={(v) => handleSave({ experienceLevel: v })}
                    >
                      <SelectTrigger id="experienceLevel">
                        <SelectValue placeholder="Select experience level" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPERIENCE_LEVELS.map((level) => (
                          <SelectItem key={level} value={level}>
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => fetchProfile()}>
                  Reset
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Links */}
          <TabsContent value="links" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-violet-600" />
                  Portfolio & Social Links
                </CardTitle>
                <CardDescription>Share your work and professional profiles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="portfolioUrl">Portfolio URL</Label>
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <Input
                        id="portfolioUrl"
                        type="url"
                        value={profile?.portfolioUrl ?? ""}
                        onChange={(e) =>
                          handleSave({ portfolioUrl: e.target.value })
                        }
                        placeholder="https://yourportfolio.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="githubUrl">GitHub URL</Label>
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <Input
                        id="githubUrl"
                        type="url"
                        value={profile?.githubUrl ?? ""}
                        onChange={(e) =>
                          handleSave({ githubUrl: e.target.value })
                        }
                        placeholder="https://github.com/yourname"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="leetcodeUrl">LeetCode URL</Label>
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <Input
                      id="leetcodeUrl"
                      type="url"
                      value={profile?.leetcodeUrl ?? ""}
                      onChange={(e) =>
                        handleSave({ leetcodeUrl: e.target.value })
                      }
                      placeholder="https://leetcode.com/yourname"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => fetchProfile()}>
                  Reset
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Skills */}
          <TabsContent value="skills" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-violet-600" />
                  Skills
                </CardTitle>
                <CardDescription>Add your technical skills and competencies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add skill form */}
                <div className="flex flex-wrap gap-2 items-center p-3 rounded-lg border border-slate-200 bg-white/50">
                  <Input
                    placeholder="Add a skill..."
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSkill()}
                    className="flex-1 min-w-[160px]"
                  />
                  <Select
                    value={newSkillCategory}
                    onValueChange={(v) => v && setNewSkillCategory(v)}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SKILL_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addSkill}
                    disabled={!newSkillName.trim()}
                    className="gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>

                {/* Skill tags display */}
                {skills.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-sm">
                    No skills added yet. Add your first skill above.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {skills.map((skill) => (
                      <div
                        key={skill.name}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200/70 bg-white/50 hover:bg-white hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="secondary"
                            className={
                              skill.category === "programming"
                                ? "bg-sky-100 text-sky-700 border-sky-200"
                                : skill.category === "framework"
                                ? "bg-violet-100 text-violet-700 border-violet-200"
                                : skill.category === "database"
                                ? "bg-amber-100 text-amber-700 border-amber-200"
                                : skill.category === "cloud"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : skill.category === "tool"
                                ? "bg-rose-100 text-rose-700 border-rose-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }
                          >
                            {skill.category}
                          </Badge>
                          <span className="text-sm font-medium text-slate-700">{skill.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-rose-500"
                          onClick={() => removeSkill(skill.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Academic */}
          <TabsContent value="academic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-violet-600" />
                  Academic Background
                </CardTitle>
                <CardDescription>Your educational qualifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="university">University</Label>
                    <Input
                      id="university"
                      value={profile?.university ?? ""}
                      onChange={(e) =>
                        handleSave({ university: e.target.value })
                      }
                      placeholder="e.g. MIT, Stanford"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="degree">Degree</Label>
                    <Input
                      id="degree"
                      value={profile?.degree ?? ""}
                      onChange={(e) =>
                        handleSave({ degree: e.target.value })
                      }
                      placeholder="e.g. B.Tech, M.S."
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="department">Department / Major</Label>
                    <Input
                      id="department"
                      value={profile?.department ?? ""}
                      onChange={(e) =>
                        handleSave({ department: e.target.value })
                      }
                      placeholder="e.g. Computer Science"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="graduationYear">Graduation Year</Label>
                    <Input
                      id="graduationYear"
                      type="number"
                      value={profile?.graduationYear ?? ""}
                      onChange={(e) =>
                        handleSave({
                          graduationYear: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      placeholder="2024"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cgpa">CGPA / GPA</Label>
                    <Input
                      id="cgpa"
                      type="number"
                      step="0.01"
                      value={profile?.cgpa ?? ""}
                      onChange={(e) =>
                        handleSave({
                          cgpa: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      placeholder="e.g. 8.5"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="relevantCoursework">Relevant Coursework</Label>
                    <Input
                      id="relevantCoursework"
                      value={profile?.relevantCoursework ?? ""}
                      onChange={(e) =>
                        handleSave({ relevantCoursework: e.target.value })
                      }
                      placeholder="e.g. Data Structures, Algorithms"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => fetchProfile()}>
                  Reset
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Certificates */}
          <TabsContent value="certificates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-violet-600" />
                  Certificates
                </CardTitle>
                <CardDescription>Upload and manage your certification documents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload area */}
                <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg border-2 border-dashed border-slate-200 bg-white/50 hover:bg-white hover:border-violet-300 transition-all cursor-pointer">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">Upload Certificate</p>
                    <p className="text-xs text-slate-500">PDF, PNG, or JPG up to 10MB</p>
                  </div>
                  <Input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleCertificateUpload}
                    className="hidden"
                    id="certUpload"
                  />
                  <Label
                    htmlFor="certUpload"
                    className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-300 text-violet-700 text-sm font-medium hover:bg-violet-50 transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Choose File
                  </Label>
                  {savingCert && (
                    <span className="text-xs text-violet-600 font-medium">
                      Uploading {savingCert}…
                    </span>
                  )}
                </div>

                {/* Certificate list */}
                {certificates.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-sm">
                    No certificates uploaded yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {certificates.map((cert) => (
                      <div
                        key={cert.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-200/70 bg-white/50 hover:bg-white hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                            <Award className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">
                              {cert.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {cert.issuer}
                              {cert.issueDate && ` · ${new Date(cert.issueDate).toLocaleDateString()}`}
                            </p>
                            {cert.credentialUrl && (
                              <a
                                href={cert.credentialUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-violet-600 hover:underline truncate"
                              >
                                View credential
                              </a>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-rose-500"
                          onClick={() => cert.id && removeCertificate(cert.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save indicator */}
        {saving && (
          <div className="fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-medium shadow-lg animate-pulse">
            <Loader2 className="h-4 w-4" />
            Saving…
          </div>
        )}
      </main>
    </div>
  );
}
