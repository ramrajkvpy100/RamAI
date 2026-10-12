import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PostView } from "@/components/community/post-view";
import { PublicPage } from "@/components/shell/public-page";
import { getCurrentUser } from "@/server/auth";
import { getPost } from "@/server/community";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = UUID.test(id) ? await getPost(id) : null;
  return { title: post ? post.title : "Community" };
}

export default async function CommunityPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await getCurrentUser().catch(() => null);
  const post = await getPost(id, user?.id);
  if (!post) notFound();
  return (
    <PublicPage>
      <div className="mx-auto w-full max-w-3xl">
        <PostView initial={post} signedIn={!!user} account={!!user && !user.isGuest} />
      </div>
    </PublicPage>
  );
}
