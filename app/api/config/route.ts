export const dynamic = "force-dynamic";

export async function GET() {
  const apiBase =
    process.env.API_BASE ??
    process.env.NEXT_PUBLIC_API_BASE ??
    "http://localhost:8080";

  return Response.json(
    { apiBase },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
