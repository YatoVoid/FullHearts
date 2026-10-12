export function POST(): Response {
  return Response.json({ error: "This form moved to /server/register/." }, { status: 410 });
}
