import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { REGISTER_PATH } from "@/const";

export default function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [, setLocation] = useLocation();
    const utils = trpc.useUtils();

    const loginMutation = trpc.auth.login.useMutation({
        onSuccess: () => {
            toast.success("Logged in successfully");
            utils.auth.me.invalidate();
            setLocation("/");
        },
        onError: (error) => {
            toast.error(error.message || "Failed to login");
        },
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        loginMutation.mutate({ username, password });
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#050505] p-4 font-sans">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full" />
            </div>

            <Card className="w-full max-w-md border-white/5 bg-white/5 backdrop-blur-xl shadow-2xl relative z-10 transition-all hover:border-white/10">
                <CardHeader className="space-y-2 pb-8">
                    <div className="flex items-center space-x-2 mb-2">
                        <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-xl">A</span>
                        </div>
                        <span className="text-2xl font-bold text-white tracking-tight">AzVirt DMS</span>
                    </div>
                    <CardTitle className="text-2xl font-bold text-white">Welcome back</CardTitle>
                    <CardDescription className="text-gray-400">
                        Enter your credentials to access your dashboard
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="username" className="text-gray-300 text-sm font-medium">Username</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                className="h-11 border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-gray-300 text-sm font-medium">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="h-11 border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20 transition-all"
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full h-11 bg-orange-600 hover:bg-orange-500 text-white font-semibold shadow-[0_0_20px_rgba(234,88,12,0.3)] transition-all active:scale-[0.98]"
                            disabled={loginMutation.isPending}
                        >
                            {loginMutation.isPending ? (
                                <div className="flex items-center space-x-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Signing in...</span>
                                </div>
                            ) : "Sign In"}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4 pt-4 border-t border-white/5 mt-4">
                    <div className="text-sm text-gray-400 text-center w-full">
                        New to AzVirt?{" "}
                        <Link href={REGISTER_PATH} className="text-orange-500 hover:text-orange-400 font-medium transition-colors">
                            Create an account
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
