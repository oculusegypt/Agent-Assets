import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import billieRouter from "./billie";
import productionRouter from "./production";
import conversationsRouter from "./conversations";
import systemRouter from "./system";
import nexusRouter from "./nexus";
import settingsRouter from "./settings";
import caeosRouter from "./caeos";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/agents", agentsRouter);
router.use("/billie", billieRouter);
router.use("/production", productionRouter);
router.use("/conversations", conversationsRouter);
router.use("/system", systemRouter);
router.use("/nexus", nexusRouter);
router.use("/settings", settingsRouter);
router.use("/caeos", caeosRouter);

export default router;
