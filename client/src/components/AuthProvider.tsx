import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useMemo, useState } from "react";
import superjson from "superjson";

const queryClient = new QueryClient();

function TrpcProvider({ children }: { children: React.ReactNode }) {
    const { getAccessTokenSilently, isAuthenticated, isLoading } = useAuth0();

    const trpcClient = useMemo(() => {
        return trpc.createClient({
            links: [
                httpBatchLink({
                    url: "/api/trpc",
                    transformer: superjson,
                    async fetch(input, init) {
                        let headers = new Headers(init?.headers);

                        if (isAuthenticated) {
                            try {
                                const token = await getAccessTokenSilently();
                                headers.set("Authorization", `Bearer ${token}`);
                            } catch (e) {
                                console.error("Error getting access token", e);
                            }
                        }

                        return globalThis.fetch(input, {
                            ...(init ?? {}),
                            headers,
                            credentials: "include",
                        });
                    },
                }),
            ],
        });
    }, [getAccessTokenSilently, isAuthenticated]);

    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </trpc.Provider>
    );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const domain = import.meta.env.VITE_AUTH0_DOMAIN;
    const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
    const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

    if (!domain || !clientId) {
        console.warn("Auth0 domain or clientId missing. Auth0 will not work properly.");
        return <>{children}</>;
    }

    return (
        <Auth0Provider
            domain={domain}
            clientId={clientId}
            authorizationParams={{
                redirect_uri: window.location.origin,
                audience: audience,
            }}
            useRefreshTokens={true}
            cacheLocation="localstorage"
        >
            <TrpcProvider>{children}</TrpcProvider>
        </Auth0Provider>
    );
}
