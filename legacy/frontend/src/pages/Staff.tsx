import { Sidebar } from "@/components/Sidebar";
import { useUsers } from "@/hooks/use-users";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Staff() {
  const { data: users } = useUsers();

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <h1 className="text-3xl font-bold font-display text-gray-900 mb-8">Staff Members</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users?.map(user => (
            <Card key={user.id} className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-lg">
                    {user.name.charAt(0)}
                  </div>
                  <CardTitle>{user.name}</CardTitle>
                </div>
                <Badge variant={user.isActive ? "default" : "destructive"}>
                  {user.isActive ? "Active" : "Inactive"}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center text-sm text-muted-foreground mt-2">
                  <span>Role</span>
                  <span className="capitalize font-medium text-foreground">{user.role}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
