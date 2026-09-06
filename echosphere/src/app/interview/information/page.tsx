"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { candidateApi } from "@/lib/api/client";
import {
  FileText, Upload, FileCode, GraduationCap, Award, CheckCircle2, AlertCircle,
  Plus, Trash2, ArrowRight, Loader2, Link as LinkIcon, Check, Sparkles, Building2, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  credentialUrl?: string;
}

function CandidateInfoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? "";

  // Resume state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string>("");
  const [uploadingResume, setUploadingResume] = useState(false);

  // GitHub project link state
  const [githubUrl, setGithubUrl] = useState("");
  const [githubError, setGithubError] = useState("");

  // Educational details state
  const [institution, setInstitution] = useState("");
  const [degree, setDegree] = useState("");
  const [department, setDepartment] = useState("");
  const [gradYear, setGradYear] = useState("");

  // Certifications state
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [newCertName, setNewCertName] = useState("");
  const [newCertIssuer, setNewCertIssuer] = useState("");
  const [newCertYear, setNewCertYear] = useState("");
  const [newCertUrl, setNewCertUrl] = useState("");

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    candidateApi
      .profile()
      .then((res) => {
        const p = res.data;
        if (p) {
          if ((p as any).resume_url) setResumeUrl((p as any).resume_url);
          if (p.githubUrl) setGithubUrl(p.githubUrl);
          if (p.university) setInstitution(p.university);
          if (p.degree) setDegree(p.degree);
          if (p.department) setDepartment(p.department);
          if (p.graduationYear) setGradYear(String(p.graduationYear));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, []);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // File validation: PDF/DOC/DOCX
    const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(file.type) && !["pdf", "doc", "docx"].includes(ext || "")) {
      toast.error("Please upload a valid PDF or DOC/DOCX resume file.");
      return;
    }

    // File size check: max 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Resume file size must be less than 10MB.");
      return;
    }

    setResumeFile(file);
    setUploadingResume(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await candidateApi.resume(fd);
      const data = await res.json();
      setResumeUrl(data.resume_url || `/uploads/resumes/${file.name}`);
      toast.success("Resume uploaded successfully!");
    } catch (err) {
      console.error("Resume upload error:", err);
      toast.error("Resume upload failed. Please try again.");
    } finally {
      setUploadingResume(false);
    }
  };

  const validateGithubUrl = (url: string) => {
    if (!url.trim()) return "GitHub URL is required.";
    const isGithub = /^https:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+/i.test(url.trim());
    if (!isGithub) return "Please enter a valid GitHub repository URL (e.g. https://github.com/user/repo).";
    return "";
  };

  const handleAddCert = () => {
    if (!newCertName.trim()) {
      toast.error("Certification name is required.");
      return;
    }
    const item: CertificationItem = {
      id: "cert_" + Date.now(),
      name: newCertName.trim(),
      issuer: newCertIssuer.trim() || "Independent Provider",
      issueDate: newCertYear.trim() || new Date().getFullYear().toString(),
      credentialUrl: newCertUrl.trim(),
    };
    setCertifications((prev) => [...prev, item]);
    setNewCertName("");
    setNewCertIssuer("");
    setNewCertYear("");
    setNewCertUrl("");
    toast.success("Certification added!");
  };

  const handleRemoveCert = (id: string) => {
    setCertifications((prev) => prev.filter((c) => c.id !== id));
  };

  const isFormValid =
    (resumeUrl || resumeFile) &&
    githubUrl.trim().length > 0 &&
    !validateGithubUrl(githubUrl) &&
    institution.trim().length > 0 &&
    degree.trim().length > 0;

  const handleSubmitInfo = async () => {
    const err = validateGithubUrl(githubUrl);
    if (err) {
      setGithubError(err);
      toast.error(err);
      return;
    }

    setSubmitting(true);
    try {
      await candidateApi.updateProfile({
        githubUrl: githubUrl.trim(),
        university: institution.trim(),
        degree: degree.trim(),
        department: department.trim(),
        graduationYear: gradYear ? parseInt(gradYear) : undefined,
      });

      toast.success("Personal information saved successfully!");
      if (sessionId) {
        router.push(`/interview/lobby?sessionId=${sessionId}`);
      } else {
        router.push(`/interview/lobby`);
      }
    } catch (err) {
      console.error("Save candidate info error:", err);
      toast.error("Failed to save information. Proceeding to System Check...");
      router.push(`/interview/lobby?sessionId=${sessionId}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-slate-500">Loading Candidate Portal…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">E</span>
            </div>
            <span className="text-lg font-semibold text-slate-800 tracking-tight">EcoSphere</span>
          </div>
          <div className="text-sm font-medium text-slate-400">Step 2: Candidate Information Portal</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Title */}
        <div>
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 mb-2">Mandatory Candidate Stage</Badge>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Personal Information Portal</h1>
          <p className="text-slate-500 mt-1">
            Provide your resume, project repo, education, and certifications to personalize your AI mock interviewer.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* A. Resume Upload */}
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-blue-600" />
                A. Candidate Resume
              </CardTitle>
              <CardDescription>Upload your latest resume (PDF or DOC/DOCX, max 10MB)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 hover:border-blue-300 transition-all text-center">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  {uploadingResume ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                </div>
                {resumeUrl ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5 justify-center">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Resume Attached
                    </p>
                    <p className="text-xs text-slate-500 truncate max-w-[200px] mx-auto">
                      {resumeFile?.name || resumeUrl}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-slate-700">Click to upload or drag resume file</p>
                    <p className="text-xs text-slate-400 mt-1">PDF, DOC, DOCX up to 10MB</p>
                  </div>
                )}

                <Input
                  id="resumeInput"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleResumeUpload}
                  className="hidden"
                />
                <Label
                  htmlFor="resumeInput"
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer shadow-sm"
                >
                  {resumeUrl ? "Replace Resume" : "Select Resume File"}
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* B. Best Project GitHub Link */}
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileCode className="h-5 w-5 text-slate-800" />
                B. Best Project GitHub Link
              </CardTitle>
              <CardDescription>Enter the GitHub repository URL of your top technical project</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="githubUrl" className="text-xs font-medium text-slate-700">
                  GitHub Repository URL *
                </Label>
                <div className="relative">
                  <Input
                    id="githubUrl"
                    type="url"
                    value={githubUrl}
                    onChange={(e) => {
                      setGithubUrl(e.target.value);
                      setGithubError(validateGithubUrl(e.target.value));
                    }}
                    placeholder="https://github.com/username/best-project"
                    className={`pl-9 ${githubError ? "border-rose-400 focus:ring-rose-200" : ""}`}
                  />
                  <FileCode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
                {githubError ? (
                  <p className="text-xs text-rose-500 font-medium">{githubError}</p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    The interviewer will evaluate code structure and architecture from this project.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* C. Educational Details */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-5 w-5 text-violet-600" />
              C. Educational Details
            </CardTitle>
            <CardDescription>Your academic background and degree information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="inst">Institution / College / University *</Label>
                <Input
                  id="inst"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g. Stanford University"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deg">Degree *</Label>
                <Input
                  id="deg"
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  placeholder="e.g. Bachelor of Science (B.S.)"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="dept">Department / Branch</Label>
                <Input
                  id="dept"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Computer Science & Engineering"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="year">Graduation Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={gradYear}
                  onChange={(e) => setGradYear(e.target.value)}
                  placeholder="2025"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* D. Certifications */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-5 w-5 text-amber-500" />
              D. Certifications (Optional)
            </CardTitle>
            <CardDescription>Add relevant professional certifications and credentials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add cert inline form */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  placeholder="Certification Name (e.g. AWS Solutions Architect)"
                  value={newCertName}
                  onChange={(e) => setNewCertName(e.target.value)}
                />
                <Input
                  placeholder="Issuing Organization (e.g. Amazon Web Services)"
                  value={newCertIssuer}
                  onChange={(e) => setNewCertIssuer(e.target.value)}
                />
                <Input
                  placeholder="Year / Issue Date"
                  value={newCertYear}
                  onChange={(e) => setNewCertYear(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Credential URL (optional)"
                  value={newCertUrl}
                  onChange={(e) => setNewCertUrl(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleAddCert} className="gap-1 text-slate-700">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>

            {/* Certifications list */}
            {certifications.length > 0 && (
              <div className="space-y-2">
                {certifications.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs">
                        <Award className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                        <p className="text-xs text-slate-500">
                          {c.issuer} · {c.issueDate}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-rose-500 h-8 w-8"
                      onClick={() => handleRemoveCert(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gating & Submit */}
        <div className="flex flex-col items-end gap-3 pt-4">
          <Button
            size="lg"
            className="w-full sm:w-auto px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-md h-12 text-base gap-2"
            onClick={handleSubmitInfo}
            disabled={!isFormValid || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Saving Candidate Info…
              </>
            ) : (
              <>
                Save &amp; Continue to System Check
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </Button>

          {!isFormValid && (
            <p className="text-xs text-rose-500 flex items-center gap-1 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              Please attach a resume, valid GitHub repository link, institution, and degree to proceed.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

export default function CandidateInformationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    }>
      <CandidateInfoContent />
    </Suspense>
  );
}
