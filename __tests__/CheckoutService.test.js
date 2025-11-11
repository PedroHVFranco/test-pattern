import { CheckoutService } from '../src/services/CheckoutService.js';
import { Item } from '../src/domain/Item.js';
import { Pedido } from '../src/domain/Pedido.js';
import UserMother from './builders/UserMother.js';
import { CarrinhoBuilder } from './builders/CarrinhoBuilder.js';

describe('CheckoutService', () => {
    describe('quando o pagamento falha', () => {
        test('deve retornar null e não salvar nem enviar e-mail', async () => {
            const carrinho = new CarrinhoBuilder().build();

            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };

            const pedidoRepositoryDummy = { salvar: jest.fn() };
            const emailServiceDummy = { enviarEmail: jest.fn() };

            const checkoutService = new CheckoutService(gatewayStub, pedidoRepositoryDummy, emailServiceDummy);

            const pedido = await checkoutService.processarPedido(carrinho, { numero: '4111111111111111' });

            expect(pedido).toBeNull();
            expect(pedidoRepositoryDummy.salvar).not.toHaveBeenCalled();
            expect(emailServiceDummy.enviarEmail).not.toHaveBeenCalled();
        });
    });

    describe('quando um cliente Premium finaliza a compra', () => {
        test('deve aplicar 10% de desconto, cobrar o valor correto e enviar e-mail', async () => {
            const user = UserMother.umUsuarioPremium();

            const itens = [new Item('A', 100), new Item('B', 100)]; // total 200

            const carrinho = new CarrinhoBuilder().comUser(user).comItens(itens).build();

            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };

            const pedidoSalvo = new Pedido(123, carrinho, 180, 'PROCESSADO');
            const pedidoRepositoryStub = { salvar: jest.fn().mockResolvedValue(pedidoSalvo) };

            const emailMock = { enviarEmail: jest.fn().mockResolvedValue(true) };

            const checkoutService = new CheckoutService(gatewayStub, pedidoRepositoryStub, emailMock);

            const pedido = await checkoutService.processarPedido(carrinho, { numero: '4111111111111111' });

            // Verificação do Gateway (valor com desconto)
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, expect.any(Object));

            // Verificação do Repository (salvou e retornou o pedido)
            expect(pedidoRepositoryStub.salvar).toHaveBeenCalledTimes(1);
            expect(pedido).toEqual(pedidoSalvo);

            // Verificação do EmailService
            expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
            expect(emailMock.enviarEmail).toHaveBeenCalledWith(
                user.email,
                'Seu Pedido foi Aprovado!',
                `Pedido ${pedidoSalvo.id} no valor de R$${180}`
            );
        });
    });
});
