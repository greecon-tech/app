import { IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, Min, MaxLength } from "class-validator";
import { ModbusConnection, deviceProtocols, statusLabels } from "@greecon/shared";

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  assetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  gatewayId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  deviceType?: string;

  @IsOptional()
  @IsIn(deviceProtocols)
  protocol?: (typeof deviceProtocols)[number];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
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
  @MaxLength(500)
  placementNote?: string;

  // null takes the address away; left out, it is left as it is.
  @IsOptional()
  @IsObject()
  connection?: ModbusConnection | null;
}
