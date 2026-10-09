import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { AgentCoverAccessUpdate, AgentCoverAccessUser, HealthStatus } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getSetAgentCoverUploadAccessUrl: (id: number) => string;
/**
 * Enables or disables cover-photo management for an Agent account. Requires an authenticated administrator.
 * @summary Set Agent cover upload access
 */
export declare const setAgentCoverUploadAccess: (id: number, agentCoverAccessUpdate: AgentCoverAccessUpdate, options?: Parameters<typeof customFetch>[1]) => Promise<AgentCoverAccessUser>;
export declare const getSetAgentCoverUploadAccessMutationKey: () => readonly ["setAgentCoverUploadAccess"];
export declare const getSetAgentCoverUploadAccessMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof setAgentCoverUploadAccess>>, TError, SetAgentCoverUploadAccessMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof setAgentCoverUploadAccess>>, TError, SetAgentCoverUploadAccessMutationVariables, TContext>;
export type SetAgentCoverUploadAccessMutationResult = NonNullable<Awaited<ReturnType<typeof setAgentCoverUploadAccess>>>;
export type SetAgentCoverUploadAccessMutationBody = BodyType<AgentCoverAccessUpdate>;
export type SetAgentCoverUploadAccessMutationError = ErrorType<void>;
export type SetAgentCoverUploadAccessMutationVariables = {
    id: number;
    data: BodyType<AgentCoverAccessUpdate>;
};
/**
* @summary Set Agent cover upload access
*/
export declare const useSetAgentCoverUploadAccess: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof setAgentCoverUploadAccess>>, TError, SetAgentCoverUploadAccessMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof setAgentCoverUploadAccess>>, TError, SetAgentCoverUploadAccessMutationVariables, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map