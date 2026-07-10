"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
const seeding_service_1 = require("./database/seeding.service");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors();
    app.useGlobalPipes(new common_1.ValidationPipe({ transform: true, whitelist: true, transformOptions: { enableImplicitConversion: true } }));
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('RxSoft Identity Service')
        .setDescription('User, authentication, organization and location management')
        .setVersion('0.1.0')
        .addBearerAuth()
        .build();
    swagger_1.SwaggerModule.setup('docs', app, swagger_1.SwaggerModule.createDocument(app, swaggerConfig));
    await app.get(seeding_service_1.DatabaseSeedService).runSeedsOnStartup();
    const port = app.get(config_1.ConfigService).get('PORT', 8092);
    await app.listen(port);
    console.log(`Identity service running on port ${port}`);
}
void bootstrap();
//# sourceMappingURL=main.js.map