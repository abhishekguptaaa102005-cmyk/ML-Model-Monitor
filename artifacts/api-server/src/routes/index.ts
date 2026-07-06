import { Router, type IRouter } from "express";
import healthRouter from "./health";
import modelsRouter from "./models";
import driftRouter from "./drift";
import latencyRouter from "./latency";
import alertsRouter from "./alerts";
import featuresRouter from "./features";
import summaryRouter from "./summary";
import ingestRouter from "./ingest";

const router: IRouter = Router();

router.use(healthRouter);
router.use(modelsRouter);
router.use(driftRouter);
router.use(latencyRouter);
router.use(alertsRouter);
router.use(featuresRouter);
router.use(summaryRouter);
router.use(ingestRouter);

export default router;
