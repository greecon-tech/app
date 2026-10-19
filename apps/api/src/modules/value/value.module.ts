import { Module } from "@nestjs/common";
import { ValueController } from "./value.controller";

@Module({ controllers: [ValueController] })
export class ValueModule {}
