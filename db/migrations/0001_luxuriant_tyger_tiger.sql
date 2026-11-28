CREATE TABLE "board_live" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"doc" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_live" ADD CONSTRAINT "board_live_id_boards_id_fk" FOREIGN KEY ("id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_live_org_idx" ON "board_live" USING btree ("org_id");--> statement-breakpoint
insert into public.board_live (id, org_id, title, doc, updated_at)
  select id, org_id, title, doc, updated_at from public.boards
  on conflict (id) do nothing;--> statement-breakpoint
create or replace function public.sync_board_live() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.board_live where id = old.id;
    return old;
  end if;
  insert into public.board_live (id, org_id, title, doc, updated_at)
  values (new.id, new.org_id, new.title, new.doc, new.updated_at)
  on conflict (id) do update
    set org_id = excluded.org_id, title = excluded.title, doc = excluded.doc, updated_at = excluded.updated_at;
  return new;
end;
$$;--> statement-breakpoint
create trigger boards_live_sync after insert or update or delete on public.boards
  for each row execute function public.sync_board_live();--> statement-breakpoint
grant select on public.board_live to neon_service;
