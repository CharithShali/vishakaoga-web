// Check req.body against a zod schema; reply 400 with a readable message if it fails.
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const first = result.error.issues[0];
      const field = first.path.join('.');
      return res.status(400).json({
        error: field ? `${field}: ${first.message}` : first.message,
      });
    }
    req.body = result.data;
    next();
  };
}
