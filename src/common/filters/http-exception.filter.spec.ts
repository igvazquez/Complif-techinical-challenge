import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
  const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
  const mockGetRequest = jest.fn().mockReturnValue({
    url: '/test-url',
    method: 'GET',
  });

  const mockArgumentsHost = {
    switchToHttp: jest.fn().mockReturnValue({
      getResponse: mockGetResponse,
      getRequest: mockGetRequest,
    }),
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('catch', () => {
    it('should handle HttpException with string response', () => {
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Not Found',
          path: '/test-url',
          method: 'GET',
        }),
      );
    });

    it('should handle HttpException with object response', () => {
      const exception = new HttpException(
        { message: 'Validation failed', errors: ['Field is required'] },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Validation failed',
          errors: ['Field is required'],
        }),
      );
    });

    it('should handle generic Error', () => {
      const exception = new Error('Something went wrong');

      filter.catch(exception, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Something went wrong',
        }),
      );
    });

    it('should handle unknown exception', () => {
      const exception = 'Unknown error';

      filter.catch(exception, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        }),
      );
    });

    it('should include timestamp in response', () => {
      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String) as unknown,
        }),
      );
    });

    it('should handle HttpException with object but no message', () => {
      const exception = new HttpException(
        { errors: ['Some error'] },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Internal server error',
          errors: ['Some error'],
        }),
      );
    });
  });
});
