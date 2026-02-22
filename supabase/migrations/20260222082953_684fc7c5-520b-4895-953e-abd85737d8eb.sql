
-- Change token_comments FK from tokens to fun_tokens
ALTER TABLE public.token_comments DROP CONSTRAINT token_comments_token_id_fkey;
ALTER TABLE public.token_comments ADD CONSTRAINT token_comments_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.fun_tokens(id) ON DELETE CASCADE;
