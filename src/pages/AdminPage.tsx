import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  Shield, 
  AlertTriangle, 
  Users, 
  FileText, 
  Ban, 
  CheckCircle2, 
  XCircle,
  Search,
  Trash2,
  UserPlus,
  Loader2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Report {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  reporter_username: string | null;
  reporter_display_name: string | null;
  reported_username: string | null;
  reported_display_name: string | null;
  post_content: string | null;
  post_author_username: string | null;
  reported_post_id: string | null;
  reported_user_id: string | null;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profile?: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export default function AdminPage() {
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { isAuthenticated, login, isLoading: authLoading } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);

  // Fetch reports and user roles
  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      setIsLoadingData(true);
      
      try {
        // Fetch reports using direct query (view requires raw query)
        const { data: reportsData, error: reportsError } = await supabase
          .from("reports")
          .select(`
            *,
            reporter:profiles!reports_reporter_id_fkey(username, display_name)
          `)
          .order("created_at", { ascending: false });

        if (reportsError) {
          console.error("Error fetching reports:", reportsError);
        } else if (reportsData) {
          // Transform the data to match our Report interface
          const transformedReports: Report[] = await Promise.all(
            reportsData.map(async (r: any) => {
              // Fetch additional data if needed
              let postContent = null;
              let postAuthorUsername = null;
              let reportedUsername = null;
              let reportedDisplayName = null;

              if (r.reported_post_id) {
                const { data: post } = await supabase
                  .from("posts")
                  .select("content, user_id")
                  .eq("id", r.reported_post_id)
                  .single();
                if (post) {
                  postContent = post.content;
                  const { data: author } = await supabase
                    .from("profiles")
                    .select("username")
                    .eq("id", post.user_id)
                    .single();
                  postAuthorUsername = author?.username || null;
                }
              }

              if (r.reported_user_id) {
                const { data: reportedUser } = await supabase
                  .from("profiles")
                  .select("username, display_name")
                  .eq("id", r.reported_user_id)
                  .single();
                reportedUsername = reportedUser?.username || null;
                reportedDisplayName = reportedUser?.display_name || null;
              }

              return {
                id: r.id,
                reason: r.reason,
                description: r.description,
                status: r.status,
                created_at: r.created_at,
                reporter_username: r.reporter?.username || null,
                reporter_display_name: r.reporter?.display_name || null,
                reported_username: reportedUsername,
                reported_display_name: reportedDisplayName,
                post_content: postContent,
                post_author_username: postAuthorUsername,
                reported_post_id: r.reported_post_id,
                reported_user_id: r.reported_user_id,
              };
            })
          );
          setReports(transformedReports);
        }

        // Fetch user roles
        const { data: rolesData, error: rolesError } = await supabase
          .from("user_roles")
          .select("*")
          .order("created_at", { ascending: false });

        if (rolesError) {
          console.error("Error fetching roles:", rolesError);
        } else {
          // Fetch profiles for each role
          const rolesWithProfiles = await Promise.all(
            (rolesData || []).map(async (role: any) => {
              const { data: profile } = await supabase
                .from("profiles")
                .select("username, display_name, avatar_url")
                .eq("id", role.user_id)
                .single();
              return { ...role, profile };
            })
          );
          setUserRoles(rolesWithProfiles);
        }
      } catch (err) {
        console.error("Failed to fetch admin data:", err);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [isAdmin]);

  const updateReportStatus = async (reportId: string, status: string) => {
    const { error } = await supabase
      .from("reports")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", reportId);

    if (error) {
      toast.error("Failed to update report status");
    } else {
      toast.success(`Report marked as ${status}`);
      setReports(reports.map(r => r.id === reportId ? { ...r, status } : r));
    }
  };

  const deletePost = async (postId: string, reportId: string) => {
    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId);

    if (error) {
      toast.error("Failed to delete post");
    } else {
      toast.success("Post deleted");
      // Update report status to resolved
      await updateReportStatus(reportId, "resolved");
    }
  };

  const addAdmin = async () => {
    if (!newAdminEmail.trim()) {
      toast.error("Please enter a profile ID or username");
      return;
    }

    setAddingAdmin(true);

    try {
      // Try to find user by username first
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", newAdminEmail.trim())
        .single();

      if (profileError || !profile) {
        // Try by ID
        const { data: profileById } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", newAdminEmail.trim())
          .single();

        if (!profileById) {
          toast.error("User not found. Enter a valid username or profile ID.");
          setAddingAdmin(false);
          return;
        }

        // Add as admin by ID
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: profileById.id, role: "admin" as any });

        if (error) {
          if (error.code === "23505") {
            toast.error("User is already an admin");
          } else {
            toast.error("Failed to add admin");
          }
        } else {
          toast.success("Admin added successfully");
          setNewAdminEmail("");
          // Refresh roles
          const { data: newRolesData } = await supabase.from("user_roles").select("*");
          if (newRolesData) {
            const rolesWithProfiles = await Promise.all(
              newRolesData.map(async (role: any) => {
                const { data: prof } = await supabase
                  .from("profiles")
                  .select("username, display_name, avatar_url")
                  .eq("id", role.user_id)
                  .single();
                return { ...role, profile: prof };
              })
            );
            setUserRoles(rolesWithProfiles);
          }
        }
      } else {
        // Add as admin by username lookup
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: profile.id, role: "admin" as any });

        if (error) {
          if (error.code === "23505") {
            toast.error("User is already an admin");
          } else {
            toast.error("Failed to add admin");
          }
        } else {
          toast.success("Admin added successfully");
          setNewAdminEmail("");
          // Refresh roles
          const { data: newRolesData } = await supabase.from("user_roles").select("*");
          if (newRolesData) {
            const rolesWithProfiles = await Promise.all(
              newRolesData.map(async (role: any) => {
                const { data: prof } = await supabase
                  .from("profiles")
                  .select("username, display_name, avatar_url")
                  .eq("id", role.user_id)
                  .single();
                return { ...role, profile: prof };
              })
            );
            setUserRoles(rolesWithProfiles);
          }
        }
      }
    } catch (err) {
      toast.error("Failed to add admin");
    } finally {
      setAddingAdmin(false);
    }
  };

  const removeAdmin = async (roleId: string, userId: string) => {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("id", roleId);

    if (error) {
      toast.error("Failed to remove admin");
    } else {
      toast.success("Admin removed");
      setUserRoles(userRoles.filter(r => r.id !== roleId));
    }
  };

  // Loading state
  if (authLoading || adminLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Shield className="h-16 w-16 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">Please sign in to access the admin panel</p>
          <Button onClick={login}>Sign In</Button>
        </div>
      </MainLayout>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Ban className="h-16 w-16 text-destructive" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page</p>
        </div>
      </MainLayout>
    );
  }

  const pendingReports = reports.filter(r => r.status === "pending");
  const resolvedReports = reports.filter(r => r.status !== "pending");

  return (
    <MainLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground text-sm">Manage reports, users, and moderation</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{pendingReports.length}</p>
                <p className="text-xs text-muted-foreground">Pending Reports</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{resolvedReports.length}</p>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{userRoles.length}</p>
                <p className="text-xs text-muted-foreground">Admins</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{reports.length}</p>
                <p className="text-xs text-muted-foreground">Total Reports</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="reports" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="reports" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Reports
              {pendingReports.length > 0 && (
                <Badge variant="destructive" className="ml-1">{pendingReports.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="admins" className="gap-2">
              <Shield className="h-4 w-4" />
              Admins
            </TabsTrigger>
          </TabsList>

          {/* Reports Tab */}
          <TabsContent value="reports" className="mt-4">
            {isLoadingData ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : reports.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-lg font-medium">No reports</p>
                  <p className="text-muted-foreground">Everything looks good!</p>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[60vh]">
                <div className="space-y-4">
                  {reports.map((report) => (
                    <Card key={report.id} className={report.status === "pending" ? "border-amber-500/50" : ""}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={report.status === "pending" ? "destructive" : "secondary"}
                            >
                              {report.status}
                            </Badge>
                            <Badge variant="outline">{report.reason}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Reporter info */}
                        <div className="text-sm">
                          <span className="text-muted-foreground">Reported by: </span>
                          <span className="font-medium">@{report.reporter_username}</span>
                        </div>

                        {/* Reported content */}
                        {report.post_content && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <p className="text-sm text-muted-foreground mb-1">
                              Post by @{report.post_author_username}:
                            </p>
                            <p className="text-sm">{report.post_content}</p>
                          </div>
                        )}

                        {report.reported_username && !report.post_content && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Reported user: </span>
                            <span className="font-medium">@{report.reported_username}</span>
                          </div>
                        )}

                        {report.description && (
                          <p className="text-sm text-muted-foreground italic">
                            "{report.description}"
                          </p>
                        )}

                        {/* Actions */}
                        {report.status === "pending" && (
                          <div className="flex gap-2 pt-2">
                            {report.reported_post_id && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deletePost(report.reported_post_id!, report.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete Post
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateReportStatus(report.id, "resolved")}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Resolve
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateReportStatus(report.id, "dismissed")}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Dismiss
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* Admins Tab */}
          <TabsContent value="admins" className="mt-4">
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-lg">Add New Admin</CardTitle>
                <CardDescription>
                  Enter a username to grant admin privileges
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="Username (e.g. john_doe)"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addAdmin()}
                  />
                  <Button onClick={addAdmin} disabled={addingAdmin}>
                    {addingAdmin ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-1" />
                        Add
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {userRoles.map((role) => (
                <Card key={role.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={role.profile?.avatar_url || ""} />
                        <AvatarFallback>
                          {role.profile?.display_name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{role.profile?.display_name || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">
                          @{role.profile?.username || "unknown"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{role.role}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAdmin(role.id, role.user_id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {userRoles.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No admins configured yet</p>
                    <p className="text-sm text-muted-foreground">Add an admin above to get started</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
