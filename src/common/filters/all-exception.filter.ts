import {
  Catch,
  HttpException,
  ExceptionFilter,
  Logger,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { TypeORMError } from 'typeorm';
import { Request, Response } from 'express';
import { CustomExceptionResponse } from '@common/interfaces/custom-exception-res.interface';
import errorMessages from '@common/message/error.message';
import { nodeEnv } from '@common/constant/constant';

@Catch(HttpException, TypeORMError)
export class AllExceptionFilter<T extends HttpException | TypeORMError>
  implements ExceptionFilter
{
  private readonly logger = new Logger();
  catch(exception: T, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const { method, originalUrl, query, headers, params, body } = request;
    const requestId = headers?.requestId;
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    try {
      const { statusCode, message, error }: CustomExceptionResponse =
        exception instanceof HttpException
          ? (exception.getResponse() as CustomExceptionResponse)
          : {
              statusCode: status,
              message: exception.message,
              error: exception.name,
            };

      const stack = exception['stack'] || message;

      this.logger.debug(
        `${method}: ${originalUrl};
        Params: ${JSON.stringify(params)};
        Query: ${JSON.stringify(query)};
        Body: ${JSON.stringify(body)};`,
        `[DEBUG] [${method}:- ${originalUrl}] {reqID: ${requestId}}`,
      );
      this.logger.error(
        JSON.stringify(exception),
        `ExceptionFilter [${originalUrl}]: {reqID: ${requestId}}`,
      );
      this.logger.error(
        JSON.stringify({ stack }),
        `ExceptionFilter-stack [${originalUrl}]: {reqID: ${requestId}}`,
      );

      response.status(status).json({
        statusCode,
        success: false,
        message: message || errorMessages.ERR0000.message,
        error,
        path: originalUrl,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === nodeEnv && { stack }),
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify(error),
        `ExceptionFilter processing error: {reqID: ${requestId}}`,
      );
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: errorMessages.ERR0000.message,
        error: 'Internal Server Error.',
        path: originalUrl,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
