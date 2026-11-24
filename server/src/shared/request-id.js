import { nanoid } from 'nanoid';

export function requestId(req, res, next) {
  req.id = req.get('x-request-id') || nanoid(12);
  res.setHeader('x-request-id', req.id);
  next();
}
