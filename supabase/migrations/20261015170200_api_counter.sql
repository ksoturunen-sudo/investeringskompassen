-- API-räknaren får bara anropas av kurstjänsten (service role).
revoke all on function public.ik_take_api_call(integer) from public, anon, authenticated;
grant execute on function public.ik_take_api_call(integer) to service_role;
