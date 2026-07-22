import express from "express";
import cors from "cors";
import projectsRouter from "./routes/projects.js";
import chatRouter from "./routes/chat.js";
import wechatRouter from "./routes/wechat.js";

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/v1/projects', projectsRouter);
app.use('/api/v1/projects', chatRouter);
app.use('/api/v1/wechat', wechatRouter);

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
