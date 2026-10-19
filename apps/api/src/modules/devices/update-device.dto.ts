import { IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, Min } from "class-validator";
import { ModbusConnection, deviceProtocols, statusLabels } from "@greecon/shared";

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  gatewayId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  deviceType?: string;

  @IsOptional()
  @IsIn(deviceProtocols)
  protocol?: (typeof deviceProtocols)[number];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  driverType?: string;

  @IsOptional()
  @IsIn(statusLabels)
  health?: (typeof statusLabels)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  positionX?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  positionY?: number;

  @IsOptional()
  @IsString()
  placementNote?: string;

  // null takes the address away; left out, it is left as it is.
  @IsOptional()
  @IsObject()
  connection?: ModbusConnection | null;
}
